# Relay

Relay is a local-first workspace agent for running company workflows through a CLI or Discord bot. It gives the model a narrow contract: discover workflow instructions, call command-backed tools, ask for clarification when needed, and finish through an explicit handoff.

The current workspace includes:

- a TypeScript runtime in `runtime/`
- CLI and Discord transports in `cli.ts`, `transports/`, and `apps/bot/`
- typed command-backed tools in `tools/`
- workflow-facing task/tool wrappers in `tasks/` and `company/workflows/`
- company context under `company/`
- deployment support under `deploy/` and `pm2.config.cjs`
- a vendored/file-linked `pi-mono/` dependency used by the runtime

## Requirements

- Node.js 22
- pnpm 10.0.0
- At least one model API key for the coding-agent runtime
- Optional integration credentials for Discord, Google Workspace, Apollo, Instantly, Brave, or Reddit depending on the workflows you run

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Fill only the environment variables needed for your run. For a basic CLI run, start with a model key such as `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY`.

## Running Relay

Run a one-off CLI request:

```bash
pnpm relay -- "What time is it?"
```

List paused sessions:

```bash
pnpm relay -- list
pnpm relay -- list --all
```

Resume or fork a paused session:

```bash
pnpm relay -- resume <session-id>
pnpm relay -- fork <session-id>
```

Run the Discord bot:

```bash
pnpm start
```

The Discord bot requires `DISCORD_TOKEN` in `.env.local`.

## Google Workspace OAuth

Google Workspace tools use OAuth credentials from `.env.local`:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

Create a Google OAuth app with the required Workspace APIs enabled, then generate a refresh token:

```bash
pnpm gmail:connect
```

The helper listens on `http://127.0.0.1:3000/oauth2callback` and prints the refresh token to place in `.env.local`.

## Development

```bash
pnpm check
pnpm test
```

`pnpm check` runs TypeScript with `tsconfig.base.json`. `pnpm test` runs Node's test runner across tool, task, runtime, and company workflow tests.

CI runs the same checks on GitHub Actions using Node 22 and pnpm 10.0.0.

## Project Structure

| Path | Purpose |
| --- | --- |
| `cli.ts` | CLI entry point for new, resumed, and forked sessions |
| `apps/bot/` | Discord bot transport |
| `runtime/` | Agent loop, local session persistence, thread serialization, and runtime helpers |
| `transports/` | CLI, TUI, and Discord adapters |
| `tools/` | Typed tool declarations and integration clients |
| `tasks/` | Reusable task declarations and runnable task wrappers |
| `company/` | Company-specific context and workflows |
| `packages/` | Small shared packages for contracts, env loading, and logging |
| `deploy/` | VM deployment notes and setup scripts |
| `pi-mono/` | Local package dependency used by Relay |

Runtime state is written to ignored local directories such as `.contexts/`, `.runs/`, `.context/`, `.tmp/`, and `.relay/`.

## Tool And Workflow Contract

Workflow tools are executable commands that read JSON from stdin and write typed JSON to stdout:

```json
{ "ok": true, "result": { } }
{ "ok": false, "error": { "type": "error_type", "message": "Human readable detail" } }
```

Typed tools live under `tools/<provider>/<tool.name>/tool.ts` and usually use `defineTool()` plus `runDeclaredTool()` from `tools/sdk.ts`.

Workflow-facing shims live under `company/workflows/<workflow>/tools/` as either:

- a flat executable file for simple shims
- a directory with `run`, `README.md`, and `package.json` for larger tools

Document workflow behavior in `company/workflows/<workflow>/README.md` so the runtime can discover and use it safely.

## Deployment

Production deployment is documented in `deploy/DEPLOYMENT.md`. The GitHub workflow deploys from `main` after CI passes, then restarts the PM2 process defined in `pm2.config.cjs`.

Keep deployment credentials in GitHub Actions secrets and runtime credentials in `.env.local`; never commit secrets.

## Contributing

See `CONTRIBUTING.md` for contribution workflow, quality checks, and documentation expectations.

## License

MIT. See `LICENSE`.
