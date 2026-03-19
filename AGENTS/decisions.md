# Decisions Log

Record non-obvious decisions here before starting work. Future sessions read this first.

---

## 2026-03-19

**tools/_generated/ is dead code — do not commit it**
Nothing imports the generated registry, model-tools, prompts, or types at runtime. The CLI discovers tools via `tree workflows`, not from the registry. Deleted. Codegen still works locally but output is gitignored in spirit.

**workflow shims are thin — no logic in `run` scripts**
The `run` script under `workflows/<name>/tools/<tool>/` is a one-liner `exec tsx <tool.ts>`. All logic lives in `tool.ts`. The shim exists only for discoverability via `tree workflows`.

**approval gate uses DESTRUCTIVE_PATTERNS regex, not manifest.destructive**
`cli.ts` only sees bash command strings — it cannot look up tool declarations at intercept time. The manifest `destructive` flag is the right long-term answer (TODOS.md P1) but requires moving the gate into `runDeclaredTool`. For now: add a regex to `DESTRUCTIVE_PATTERNS` for every destructive tool path.

**output envelope: { ok, result/error } — not raw fields**
`runDeclaredTool` wraps all output. `onError` returns `ToolErrorInfo` (`{ type, message? }`), not a fake output shape. Output schemas have no `error` field. See `AGENTS/rules/tool-output-envelope.md`.

**convex removed — not in scope for CLI agent architecture**
Convex was the original persistence layer. The current architecture is a local CLI loop with no durable backend. Removed 2026-03-19.

**company/ for company-specific workflows**
Workflows specific to a company context live under `company/workflows/` rather than root `workflows/`. Root `workflows/` is for generic/reusable workflows.

**no web search in pi-mono**
`pi-mono/packages/web-ui` is a UI component library, not a search tool. `web.search` must be built from scratch (Brave API) for the sales_outreach workflow.

**web.search tool: Brave Search API via direct REST**
Chose Brave over Tavily/Exa/Serper. Fits Unix tool philosophy — simple HTTP call, structured JSON snippets, no AI preprocessing. Independent index (not Google scraping). 2k free/mo, $5/1k paid, 50 req/s. No official TS SDK needed — plain `fetch`. If full page content is needed later, add a separate `web.fetch` tool (see OpenClaw pattern). Tavily returns full content but adds an extra abstraction layer we don't need yet.

**credentials are required per tool, not by a shared sales preflight module**
Do not use a broad `tools/lib/env.ts` that fails on unrelated provider keys. Each tool validates only the credential it actually needs at runtime, for example `web.search` requires `BRAVE_API_KEY` and nothing else. If workflow-level preflight is needed later, add it at the workflow entrypoint, not inside reusable tool modules.
