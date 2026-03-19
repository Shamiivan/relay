---
status: ACTIVE
revised: 2026-03-19 (v3 — eng review: safety gate, state model, test scope, inspector, codegen)
---
# Plan: Sales Workflow Foundation
Branch: main | Repo: relay

## What this plan is

Build the `sales_outreach` workflow in Relay — the AI-assisted campaign creation process currently done manually via Claude Code sessions. Human-in-the-loop throughout. Convex not involved.

---

## The Real Workflow (Apollo + Instantly)

```
USER: "let's build a campaign for [segment]"
          │
          ▼
    ┌─────────────────────────────────────────┐
    │  PHASE 1: Discovery (multi-turn HITL)   │
    │  Agent asks about:                      │
    │  - Offer (what are you selling?)        │
    │  - ICP (who is the ideal customer?)     │
    └─────────────────┬───────────────────────┘
                      │
                      ▼
    ┌─────────────────────────────────────────┐
    │  PHASE 2: Research (agent autonomous)   │
    │  - web.search: current problems,        │
    │    how market frames pain               │
    │  - Read: workflows/sales_outreach/      │
    │    context/ (offer framing, competitor  │
    │    framing, past campaigns)             │
    └─────────────────┬───────────────────────┘
                      │
                      ▼
    ┌─────────────────────────────────────────┐
    │  PHASE 3: Offer Creation (HITL)         │
    │  Agent drafts offer copy                │
    │  Human reviews + approves/edits         │
    │  → writes session file on approval      │
    └─────────────────┬───────────────────────┘
                      │  human approved offer
                      ▼
    ┌─────────────────────────────────────────────────┐
    │  PHASE 4: Prospecting (Apollo)                  │
    │  1. apollo.search_companies (ICP org match)     │
    │  2. apollo.search_people (scoped to company IDs)│
    │  Human approves list + count                    │
    │  → updates session file on approval             │
    └─────────────────┬───────────────────────────────┘
                      │  human approved list
                      ▼
    ┌─────────────────────────────────────────┐
    │  PHASE 5: Campaign Creation (Instantly) │
    │  DESTRUCTIVE — two separate approvals   │
    │  1. instantly.create_campaign           │
    │     → manifest.destructive gate fires   │
    │     → campaign_id captured in session   │
    │  2. instantly.add_leads (bulk)          │
    │     → manifest.destructive gate fires   │
    │  If add_leads denied: orphan campaign   │
    │  remains in Instantly (see TODOS.md P2) │
    └─────────────────────────────────────────┘

Session file is in the workflow directory.
workflow/sales_outreach/sessions/session_{ts}.json
Written after each loop turn.
```

---

## Tools to build

| Tool | API | Capability | Already exists? |
|------|-----|-----------|-----------------|
| `web.search` | Brave/curl | search | No — build as defineTool |
| `apollo.search_people` | Apollo.io API | search | No |
| `apollo.search_companies` | Apollo.io API | search | No |
| `instantly.create_campaign` | Instantly.ai API | create | No — DESTRUCTIVE |
| `instantly.add_leads` | Instantly.ai API | create | No — DESTRUCTIVE |

Note: `files.read` removed — agent uses bash to read context files.
MCP tools for Apollo and Instantly exist in Claude Code session context but are
not callable from the agent's bash subprocess. These `defineTool` wrappers are required.

Tool directories: `tools/apollo/`, `tools/instantly/`, `tools/web/`
(flat structure, intentionally diverging from `tools/gworkspace/` nesting)

---


## Safety model

Destructive tools are gated via `manifest.destructive === true`, read from the
generated manifest at dispatch time in `cli.ts`. This replaces the old
`DESTRUCTIVE_PATTERNS` regex approach.

```
defineTool({
  name: "instantly.create_campaign",
  destructive: true,   // <-- drives the approval gate
  ...
})

// cli.ts: reads manifest, not regex
const manifest = getManifest(toolName);
if (manifest.destructive) {
  await askApproval(command);
}
```

A longer-term P1 (in TODOS.md) will move the gate into `runDeclaredTool` itself
so it's unforgeable regardless of how tools are invoked.

---

## Context files (per-workflow, not cross-repo)

Agent reads these during Phase 2:
- `workflows/sales_outreach/context/marketing/` — offer framing, campaign briefs
- `workflows/sales_outreach/context/competitions/` — competitor framing of problems
- `workflows/sales_outreach/context/campaigns/` — past campaign references

These files are migrated from alara (see TODOS.md P1: per-workflow context).
The workflow README instructs the agent to use these local paths.
Context files are read-only and committed to the repo.

---

## Scope (confirmed — v3 after eng review)

### Must have
1. `tools/apollo/apollo.search_people/` — tool wrapping Apollo people search
2. `tools/apollo/apollo.search_companies/` — tool wrapping Apollo company search
3. `tools/instantly/instantly.create_campaign/` — tool (DESTRUCTIVE, manifest-gated)
4. `tools/instantly/instantly.add_leads/` — tool (DESTRUCTIVE, manifest-gated)
5. `tools/web/web.search/` — web search defineTool (enables fixture capture for Phase 2)
6. `workflows/sales_outreach/` — workflow directory with README + tool shims
7. Run codegen + commit `tools/_generated/` after each tool group added
8. Update `cli.ts` safety gate: manifest `destructive` field replaces `DESTRUCTIVE_PATTERNS` regex
9. Session file state: agent writes `/tmp/sales_outreach_session_{ts}.json` after each approval
10. Runtime tests — 8 failure modes (see Test Coverage below)
11. Fixture system — capture at `runDeclaredTool` boundary; versioned format (P2 TODO)
12. GitHub Actions CI — add `test` script to `package.json` first
13. Thread inspector — side-by-side process: `cli.ts` writes `Thread.events[]` to a pipe/file, `apps/inspector-local/` reads and renders with Ink

### Test coverage (8 failure modes)
1. Approval denial (Phase 3, Phase 5 create, Phase 5 leads)
2. MAX_TURNS exhaustion — session file prevents re-running destructive steps
3. Malformed JSON from tool subprocess
4. Apollo auth failure → `ok:false` type=auth_error
5. Apollo 429 rate limit → `ok:false` type=rate_limit_error
6. Apollo empty results → agent asks user to widen ICP, does not proceed to Instantly
7. `instantly.add_leads` partial import failure → agent reports count + asks for next action
8. Session file resume — restart at Phase 4 reads Phase 3 approval, skips HITL re-run

### Not in scope
- Gmail tools for this workflow (Gmail is board_meeting_prep territory)
- Convex integration or persistence
- Autonomous operation
- Multiple sales workflows — one first, validate, then scale
- `pnpm cli` dead script cleanup — separate PR
- Alara → relay context migration (tracked in TODOS.md P1 — prerequisite before first production run)

---

## Key decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Runtime target | `cli.ts` in-memory thread loop | Convex being rethought |
| HITL model | Always — agent drafts, human approves destructive actions | Not autonomous |
| Apollo/Instantly | Build as `defineTool` wrappers | Same pattern as existing gmail tools; MCP not accessible from agent bash context |
| Fixture boundary | Tool boundary (`runDeclaredTool` stdin/stdout) | Covers all 5 tools including web.search |
| Safety gate | `manifest.destructive` field, not `DESTRUCTIVE_PATTERNS` regex | Explicit > clever; DRY with SDK metadata |
| Session state | `/tmp/` JSON file after each approval | Prevents duplicate destructive actions on restart |
| Thread inspector | Side-by-side process via IPC | `cli.ts` already owns stdin/stdout; Ink can't share the TTY |
| Tool directory | `tools/apollo/`, `tools/instantly/`, `tools/web/` flat | Intentional divergence from gworkspace nesting |
| Context files | `workflows/sales_outreach/context/` local | Per-workflow, no cross-repo path assumption |
| Apollo prospecting | search_companies first → search_people scoped to company IDs | README defines this protocol; prevents agent guessing |
| Codegen | Explicit step after each tool group | Without it, tools not wired into CLI |

---

## Deferred to TODOS.md
- Port follow-up / proposal workflows — after outreach validates
- P1: Tool execution timeout (in TODOS.md)
- P1: In-tool approval gate (move gate into runDeclaredTool, not cli.ts interception)
- P1: Per-workflow context migration (alara → workflows/sales_outreach/context/)
- P2: Fixture format versioning (in TODOS.md)
- P2: Apollo pagination / total_count exposure
- P2: instantly.delete_campaign for orphan campaign cleanup
