# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here

Read `PLAN.md` before touching any code. It defines the philosophy, architecture, and active constraints. Do not skip it.

Check `AGENTS/decisions.md` for past decisions before proposing a new approach — the answer may already exist.

## Commands

```bash
pnpm check          # typecheck the full repo
pnpm test           # run the repo test suite
pnpm tools:codegen  # regenerate tools/_generated/ (run after adding a tool — optional, see below)
pnpm gmail:connect  # OAuth flow for Google Workspace credentials
```

## Architecture

**Entry point:** `cli.ts` — a thread-based agent loop. One bash tool. Max 20 turns. The LLM discovers tools by reading `tree workflows` output pre-loaded into the thread, then calls them via bash.

**Tool contract:** any executable under `workflows/<name>/tools/<tool>/run` that reads JSON from stdin and writes JSON to stdout. Output is always:
```json
{ "ok": true,  "result": { ... } }
{ "ok": false, "error":  { "type": "...", "message": "..." } }
```
Always check `ok` first. Never inspect raw fields to determine success.

**TypeScript tools:** `tools/<provider>/<tool.name>/tool.ts` — use `defineTool()` + `runDeclaredTool()` from `tools/sdk.ts`. The `run` shim under the workflow directory is a one-liner `exec tsx <tool.ts>`.

**Approval gate:** destructive bash commands are matched by `DESTRUCTIVE_PATTERNS` regex in `cli.ts`. The agent must not call destructive tools without a matching pattern — or the gate is silent.

**Thread events:** `system_note`, `executable_call`, `executable_result`, `user_message`, `human_response`, `assistant_message`, `model_response`. Serialized to XML-like format for the LLM each turn.

## Adding a tool

1. `tools/<provider>/<tool.name>/tool.ts` — `defineTool()` with Zod input/output + `if (import.meta.main) runDeclaredTool(tool)`
2. `tools/<provider>/<tool.name>/prompt.md` — usage guidance for the agent
3. `workflows/<workflow>/tools/<tool.name>/run` — bash shim: `exec tsx <absolute path to tool.ts>`
4. `workflows/<workflow>/tools/<tool.name>/README.md` — input/output docs the agent reads at startup
5. If destructive: add pattern to `DESTRUCTIVE_PATTERNS` in `cli.ts`

`tools/_generated/` is not used at runtime. Codegen is optional.

## Active plan

`AGENTS/plans/2026-03-19-sales-workflow-slices.md` — sales_outreach workflow, 9 slices, Slice 0 complete.

## Google auth

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in `.env.local`. Inherited by all bash subprocesses automatically.
