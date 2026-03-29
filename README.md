# Relay

Relay is a narrow workspace agent built one use case at a time. The current tool set covers Gmail for email access, Google Drive for file lookup, and Google Sheets for spreadsheet reads and row appends.
Strong typing is a project rule: parse inputs at the boundary, keep result shapes explicit, and avoid `any` or loose records in core paths.
Persistence runs through Convex, and machine-owned config lives in JSON.
Execution happens in a local worker process, while Convex stores sessions, session messages, runs, run steps, tool calls, and runtime events in `/convex`.

## Current Shape

The current vertical slice is: Discord message in, run persisted in Convex, local worker discovers command tools from `tools/`, executes them through one specialist, reply back to Discord.
The backend source of truth lives directly in `convex`, the worker lives in `runtime/src`, prompts and static context stay in Markdown, and config stays in JSON.

## Company Context

Root `workflows/` is for generic, reusable workflows.
`company/` is for company-specific context, discovery material, and workflows that depend on one company's operating reality.

When a workflow needs company context first, put that workflow under `company/workflows/` and make the discovery step explicit.
Company background should live alongside the workflow in `company/<name>/` rather than in a separate sibling repo.

Relay keeps one architectural rule intentionally narrow:

- session history is for humans
- run steps are for the runtime

That means:

- `sessionMessages` stores only visible `user_message` and `assistant_message`
- `runSteps` stores coarse runtime stages for one run
- `toolCalls` stores one record per tool invocation
- `events` stores append-only runtime audit history
- the worker compiles a fresh model request each turn instead of replaying mixed event history

## How To Read

Read the repo by following one request through the system.

1. Start with [PLAN.md](/home/shami/workspaces/relay/PLAN.md) for the design constraints and [configs/specialists/communication.json](/home/shami/workspaces/relay/configs/specialists/communication.json) for the active specialist.
2. Read [apps/bot/src/index.ts](/home/shami/workspaces/relay/apps/bot/src/index.ts) to see how Discord creates a run and waits for the result.
3. Read [convex/runs.ts](/home/shami/workspaces/relay/convex/runs.ts), [convex/sessionMessages.ts](/home/shami/workspaces/relay/convex/sessionMessages.ts), [convex/runSteps.ts](/home/shami/workspaces/relay/convex/runSteps.ts), [convex/toolCalls.ts](/home/shami/workspaces/relay/convex/toolCalls.ts), and [convex/events.ts](/home/shami/workspaces/relay/convex/events.ts) to see what is stored durably.
4. Read [runtime/src/compile/compile-run-input.ts](/home/shami/workspaces/relay/runtime/src/compile/compile-run-input.ts) and [runtime/src/compile/replay-session-messages.ts](/home/shami/workspaces/relay/runtime/src/compile/replay-session-messages.ts) to see how visible session history, run steps, and tool-call results become one compiled model request.
5. Read [runtime/src/worker.ts](/home/shami/workspaces/relay/runtime/src/worker.ts), [runtime/src/execution/run-loop.ts](/home/shami/workspaces/relay/runtime/src/execution/run-loop.ts), and [runtime/src/execution/open-loop.ts](/home/shami/workspaces/relay/runtime/src/execution/open-loop.ts) to see how the local runtime dispatches execution, calls the model adapter, executes tools, and writes results back.
6. Read [runtime/src/tools.ts](/home/shami/workspaces/relay/runtime/src/tools.ts), [tools/gmail.search/run.ts](/home/shami/workspaces/relay/tools/gmail.search/run.ts), [tools/gmail.read/run.ts](/home/shami/workspaces/relay/tools/gmail.read/run.ts), [tools/drive.search/run.ts](/home/shami/workspaces/relay/tools/drive.search/run.ts), [tools/drive.getFile/run.ts](/home/shami/workspaces/relay/tools/drive.getFile/run.ts), [tools/gsheets.readValues/run.ts](/home/shami/workspaces/relay/tools/gsheets.readValues/run.ts), and [tools/gsheets.appendRow/run.ts](/home/shami/workspaces/relay/tools/gsheets.appendRow/run.ts) for the actual tool integrations.
7. Read [convex/schema.ts](/home/shami/workspaces/relay/convex/schema.ts) last to confirm the storage model.

## Running

Use `pnpm dev` to start Convex, the local worker, and the Discord bot together.
Use `pnpm check` to typecheck the full repo.

## Connect Gmail

Relay already calls Google Workspace APIs through local tool commands. To connect Gmail, Google Drive, Google Docs, and Google Sheets, you need Google OAuth client credentials plus one refresh token in `.env.local`.

Add these keys:

```env
CONVEX_URL=...
DISCORD_TOKEN=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

Create a Google OAuth app with Gmail API enabled and add one redirect URI, for example `http://127.0.0.1:3000/oauth2callback`.

Generate the refresh token with the smoother local callback flow:

```bash
pnpm gmail:connect
```

This opens the browser, listens on `http://127.0.0.1:3000/oauth2callback`, and prints the `GOOGLE_REFRESH_TOKEN` value to place in `.env.local`.
The consent flow now requests a broad Google Workspace scope set for Gmail, Drive, Docs, Sheets, and Calendar so new tools in those domains do not require another re-consent later.

If you previously generated a refresh token before Drive write or Docs access were added, generate a fresh token again. Older tokens can search/read Drive but still fail when Relay tries to copy or edit documents.

Manual mode is still available if you want to paste a code yourself:

```bash
pnpm gmail:connect -- --redirect-uri=http://127.0.0.1:3000/oauth2callback --code=PASTE_CODE_HERE
```
