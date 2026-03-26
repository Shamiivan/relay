# Relay Deployment

## Overview

Relay runs on a GCP Compute Engine VM. Pushing to `main` auto-deploys via GitHub Actions.

```
git push origin main  →  GitHub Actions SSHs into VM  →  git pull + pnpm install + pm2 reload  →  live in ~30s
```

## Infrastructure

| Component | Details |
|-----------|---------|
| **VM** | `relay-bot`, GCP Compute Engine, `us-east1-b` |
| **Machine type** | `e2-medium` (1 vCPU shared, 4GB RAM) |
| **OS** | Debian 12 |
| **Disk** | 20GB pd-balanced |
| **External IP** | `34.24.230.153` |
| **App user** | `relay` (home: `/home/relay/`) |
| **App directory** | `/home/relay/app/` |
| **Logs** | `/home/relay/logs/` |
| **Process manager** | PM2 (auto-restarts on crash + boot) |
| **GCP project** | `relay-bot-prod` |

## Files

| File | Purpose |
|------|---------|
| `pm2.config.cjs` | PM2 process config (restart policy, log paths) |
| `.github/workflows/vm-deploy.yml` | GitHub Actions — auto-deploy on push to `main` after CI passes |
| `deploy/vm-setup.sh` | One-time VM bootstrap (Node 22, pnpm, PM2, clone, startup) |

## GitHub Actions Secrets

Set in repo Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `VM_HOST` | VM external IP (`34.24.230.153`) |
| `VM_USERNAME` | `relay` |
| `VM_SSH_KEY` | ed25519 private key for `relay` user on the VM |

## Deploy flow

1. Push to `main`
2. CI passes (`pnpm check` + `pnpm test`)
3. GitHub Actions runs `.github/workflows/vm-deploy.yml`
4. SSHs into VM as `relay` user
5. Runs: `git pull` → `pnpm install --frozen-lockfile` → `pnpm check` → `pm2 restart relay-bot`

## SSH into the VM

```bash
gcloud compute ssh relay-bot --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap
```

## Common operations

```bash
# Check bot status
gcloud compute ssh relay-bot --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap --command="sudo -u relay pm2 status"

# View live logs
gcloud compute ssh relay-bot --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap --command="sudo -u relay pm2 logs relay-bot"

# View last 50 log lines
gcloud compute ssh relay-bot --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap --command="sudo -u relay pm2 logs relay-bot --lines 50 --nostream"

# Restart manually
gcloud compute ssh relay-bot --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap --command="sudo -u relay pm2 restart relay-bot"

# Copy .env.local to VM
gcloud compute scp .env.local relay-bot:/tmp/.env.local --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap
gcloud compute ssh relay-bot --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap --command="sudo mv /tmp/.env.local /home/relay/app/.env.local && sudo chown relay:relay /home/relay/app/.env.local && sudo -u relay pm2 restart relay-bot"
```

## Firewall

SSH (port 22) is open to your IP via `allow-ssh-myip-relay` (tag: `ssh-only`), plus IAP range via `allow-ssh-iap`.

To update if your IP changes:

```bash
gcloud compute firewall-rules update allow-ssh-myip-relay \
  --project=relay-bot-prod \
  --source-ranges="$(curl -s ifconfig.me)/32"
```

## Setup from scratch

If you ever need to rebuild the VM:

```bash
# Create VM
gcloud compute instances create relay-bot \
  --project=relay-bot-prod \
  --zone=us-east1-b \
  --machine-type=e2-medium \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=20GB \
  --boot-disk-type=pd-balanced \
  --tags=ssh-only

# SSH in and run setup (copy deploy/vm-setup.sh to VM first)
gcloud compute scp deploy/vm-setup.sh relay-bot:/tmp/vm-setup.sh --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap
gcloud compute ssh relay-bot --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap --command="sudo bash /tmp/vm-setup.sh"

# Copy env
gcloud compute scp .env.local relay-bot:/tmp/.env.local --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap
gcloud compute ssh relay-bot --project=relay-bot-prod --zone=us-east1-b --tunnel-through-iap --command="sudo mv /tmp/.env.local /home/relay/app/.env.local && sudo chown relay:relay /home/relay/app/.env.local && sudo -u relay pm2 restart relay-bot"

# Set GitHub secrets
gh secret set VM_HOST --repo Shamiivan/relay --body "<VM_IP>"
gh secret set VM_USERNAME --repo Shamiivan/relay --body "relay"
ssh-keygen -t ed25519 -f /tmp/deploy-key -N "" -C "github-actions-relay-deploy"
# Add public key to VM's /home/relay/.ssh/authorized_keys
gh secret set VM_SSH_KEY --repo Shamiivan/relay < /tmp/deploy-key
rm /tmp/deploy-key /tmp/deploy-key.pub
```
