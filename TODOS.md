# TODOS

## P1

### In-tool approval gate (architectural P1)
**What:** Move the destructive-action approval gate out of `cli.ts`'s bash command interception and into a middleware layer in `runDeclaredTool`. When `manifest.destructive === true`, the tool runner emits a `confirmation_request` thread event and waits for a `human_response` before executing the API call.
**Why:** The current regex gate in `cli.ts` is bypassable with any path variation. The gate should be unforgeable regardless of how a tool is invoked.
**Where to start:** Add `destructive` check in `runDeclaredTool` in `tools/sdk.ts`. Define `confirmation_request` event type in `runtime/src/thread.ts`. Update `cli.ts` to surface these events to the user.
**Depends on:** Decision 1 (manifest `destructive: true` field) being shipped in `sales_outreach` PR.
**Effort:** M

---

### Per-workflow context directory
**What:** Migrate the Phase 2 research context files (marketing copy, competitor framing, past campaigns) from `../alara/` into `workflows/sales_outreach/context/`. Update the workflow README to reference this local path instead of the fragile relative cross-repo path.
**Why:** The `../alara/` relative path breaks whenever `cli.ts` is launched from any directory other than the expected parent. CI cannot rely on a sibling repo being present.
**Where to start:** Identify which files from `alara/marketing/` and `alara/competitions/case_studies/` are needed → copy into `workflows/sales_outreach/context/` → update README.
**Depends on:** none. Should be done before first production `sales_outreach` run.
**Effort:** S

---

### Add tool execution timeout
**What:** Wrap bash subprocesses in `cli.ts` with a configurable timeout (default 30s) so a hanging Gmail/API call doesn't freeze the agent loop forever.
**Why:** Currently a critical gap — one network hang = permanent freeze with no user feedback.
**Where to start:** `cli.ts` bash tool `execute()` — add `timeout` option to the child process spawn.
**Effort:** S

---

## P2

### Apollo pagination: expose total_count
**What:** `apollo.search_people` and `apollo.search_companies` currently return only page 1. The tool output should include `total_count` from the Apollo API response alongside the results. The workflow README should instruct the agent to summarize total vs. returned count when presenting the list to the human for approval.
**Why:** Without `total_count`, the human approves a sample thinking it's the full list. Misleading for large ICPs.
**Where to start:** Add `total_count` field to the tool output Zod schema. Apollo API returns pagination metadata in response body.
**Depends on:** Apollo tool wrappers being shipped in `sales_outreach` PR.
**Effort:** S

---

### Instantly.delete_campaign for orphan cleanup
**What:** Build an `instantly.delete_campaign` tool. Workflow README should instruct the agent to offer campaign deletion if the user denies `add_leads` after `create_campaign` already succeeded.
**Why:** Denying the `add_leads` step leaves an empty campaign draft in Instantly with no cleanup path.
**Where to start:** MCP `mcp__instantly__delete_campaign` exists — build a `defineTool` wrapper following the same pattern as `instantly.create_campaign`. Mark as `destructive: true`.
**Depends on:** `instantly.create_campaign` being shipped + in-tool approval gate (P1).
**Effort:** S

---

### Versioned fixture format
**What:** Add a `version` field to fixture JSON files from day one: `{ version: 1, tool: "gmail.read", response: {...} }`.
**Why:** Once multiple workflows use fixtures, changing the format without versioning requires migrating all fixture files blindly.
**Where to start:** Define the fixture schema in `tests/fixtures/schema.ts` with a Zod validator when building the fixture system.
**Effort:** S
