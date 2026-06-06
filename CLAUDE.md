# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here

Read `PLAN.md` before touching any code. It defines the philosophy, architecture, and active constraints. Do not skip it.

Check `AGENTS/decisions.md` for past decisions before proposing a new approach — the answer may already exist.

## Commands

```bash
pnpm check          # typecheck the full repo
pnpm test           # run the repo test suite
pnpm gmail:connect  # OAuth flow for Google Workspace credentials
```

## Architecture

**Entry point:** `cli.ts` — a thread-based agent loop. Three tools: `bash` (built-in), `ask_human` and `done_for_now` (customTools). Max 50 turns. The LLM discovers tools by reading `tree company/workflows/` output pre-loaded into the thread, then calls them via bash when needed.

**Tool contract:** any executable under `company/workflows/<name>/tools/<tool>` (flat file) or `company/workflows/<name>/tools/<tool>/run` (directory) that reads JSON from stdin and writes JSON to stdout. Prefer flat files for simple shims. Output is always:
```json
{ "ok": true,  "result": { ... } }
{ "ok": false, "error":  { "type": "...", "message": "..." } }
```
Always check `ok` first. Never inspect raw fields to determine success.

**TypeScript tools:** `tools/<provider>/<tool.name>/tool.ts` — use `defineTool()` + `runDeclaredTool()` from `tools/sdk.ts`. The `run` shim under the workflow directory is a one-liner `exec tsx <tool.ts>`.
**Thread events:** `system_note`, `executable_call`, `executable_result`, `user_message`, `human_response`, `assistant_message`, `model_response`. Serialized to XML-like format for the LLM each turn.

## Adding a tool

1. `tools/<provider>/<tool.name>/tool.ts` — `defineTool()` with Zod input/output + `if (import.meta.main) runDeclaredTool(tool)`
2. `tools/<provider>/<tool.name>/prompt.md` — usage guidance for the agent
3. Wire it into a workflow — pick one:
   - **Flat file (preferred for simple shims):** `company/workflows/<workflow>/tools/<toolname.action>` — bash shim: `exec tsx <path to tool.ts>`. Document the tool in the workflow `README.md`.
   - **Directory (complex tools only):** `company/workflows/<workflow>/tools/<toolname.action>/run` + `README.md` + `package.json`
4. If destructive: add pattern to `DESTRUCTIVE_PATTERNS` in `cli.ts`


## Active plan

## Google auth

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in `.env.local`. Inherited by all bash subprocesses automatically.
