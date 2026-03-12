# Relay

Relay is a narrow workspace agent built one use case at a time. Phase 0 is email read access through Discord with Gmail behind a small adapter.
Strong typing is a project rule: parse inputs at the boundary, keep result shapes explicit, and avoid `any` or loose records in core paths.
Persistence runs through Convex, and machine-owned config lives in JSON.
Execution happens in a local worker process, while Convex stores runs and events in `/convex`.

## Current Shape

The current vertical slice is: Discord message in, run persisted in Convex, local worker executes Gmail search through the communication specialist, reply back to Discord.
The backend source of truth lives directly in `convex`, the worker lives in `runtime/src`, prompts and context stay in Markdown, and config stays in JSON.

## How To Read

Read the repo by following one request through the system.

1. Start with [PLAN.md](/home/shami/workspaces/relay/PLAN.md) for the design constraints and [configs/specialists/communication.json](/home/shami/workspaces/relay/configs/specialists/communication.json) for the active specialist.
2. Read [apps/bot/src/index.ts](/home/shami/workspaces/relay/apps/bot/src/index.ts) to see how Discord creates a run and waits for the result.
3. Read [convex/runs.ts](/home/shami/workspaces/relay/convex/runs.ts) to see how runs are persisted and claimed by workers.
4. Read [runtime/src/worker.ts](/home/shami/workspaces/relay/runtime/src/worker.ts) to see how the local runtime loads config, calls Gmail, and writes results back.
5. Read [packages/adapters/gmail/src/index.ts](/home/shami/workspaces/relay/packages/adapters/gmail/src/index.ts) and [packages/adapters/gmail/src/google-auth.ts](/home/shami/workspaces/relay/packages/adapters/gmail/src/google-auth.ts) for the actual provider integration.
6. Read [convex/schema.ts](/home/shami/workspaces/relay/convex/schema.ts) and [convex/events.ts](/home/shami/workspaces/relay/convex/events.ts) last to understand what is stored durably.

## Running

Use `pnpm dev` to start Convex, the local worker, and the Discord bot together.
Use `pnpm check` to typecheck the full repo.

## Connect Gmail

Relay already calls Gmail from the worker. To connect an actual mailbox, you need Google OAuth client credentials plus one refresh token in `.env.local`.

Add these keys:

```env
CONVEX_URL=...
DISCORD_TOKEN=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

Create a Google OAuth app with Gmail API enabled and add one redirect URI, for example `http://127.0.0.1:3000/oauth2callback`.

Generate the refresh token in two steps:

```bash
pnpm gmail:connect -- --redirect-uri=http://127.0.0.1:3000/oauth2callback
pnpm gmail:connect -- --redirect-uri=http://127.0.0.1:3000/oauth2callback --code=PASTE_CODE_HERE
```

The second command prints the `GOOGLE_REFRESH_TOKEN` value to place in `.env.local`.
