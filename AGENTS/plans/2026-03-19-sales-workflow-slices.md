---
status: ACTIVE
created: 2026-03-19
codex-reviewed: true
---
# Sales Workflow — Vertical Slices

## User Story

```
As a founder doing outbound sales
I want an AI agent to research, prospect, and create email campaigns
So that I can run a full sales outreach cycle without doing it manually
it should be human in the loop
```

---

## Dependency Chain

```
dead code removed
      │
      ▼
env validation + test harness
      │
      ▼
session state (atomic, stable key)
      │
      ▼
safety gate proven before destructive tools exist
      │
      ▼
search tools (web, apollo)
      │
      ▼
destructive tools (instantly)
```

---

## Slices

```
Slice 0: "Remove dead code — tools/_generated/ deleted"
→ Value: Codebase only contains code that runs. No confusion about what's wired in.
→ Code: Delete tools/_generated/ (registry.ts, model-tools.ts, prompts.ts, types.ts,
         specialists.ts). Keep tools/codegen.ts for future use.
→ Done: pnpm check passes, deleted files are gone. ✅ Already done.

Slice 1: "System tells you immediately if a credential is missing"
→ Value: Auth failures show up at startup with a clear message — not deep inside
         a tool call after 3 turns of agent work.
→ Code: tools/lib/env.ts — validates APOLLO_API_KEY, INSTANTLY_API_KEY, BRAVE_API_KEY
        on import, throws with a clear message if missing.
        Add test script to package.json.
        One test: missing env var → clear error (not a 401 from the API).
        GitHub Actions CI: runs pnpm test on push.
→ Done: pnpm test passes. CI goes green.

Slice 2: "Restarting a crashed session resumes from the last approved step"
→ Value: If the agent crashes after campaign creation but before adding leads,
         restarting picks up at the right place — no duplicate campaigns.
→ Code: tools/lib/session.ts
        - Stable key: sales_outreach_{YYYY-MM-DD}
        - Path: /tmp/relay_session_{key}.json
        - Atomic write: write to .tmp then rename
        - Schema: { phase, offer?, companyIds?, campaignId? }
        - readSession(), writeSession(), clearSession()
        Unit tests: atomic write, read-back after crash simulation.
→ Done: writeSession → process.exit → readSession returns correct state.

Slice 3: "Instantly operations always ask for approval before running"
→ Value: Agent can never silently create a campaign or upload leads.
         Every destructive call surfaces to the user first.
→ Code: Update DESTRUCTIVE_PATTERNS in cli.ts:
          /workflows\/sales_outreach\/tools\/instantly\./
        Unit test: mock bash execution, verify gate fires for instantly.* paths,
        does not fire for apollo.* or web.search paths.
→ Done: Approval prompt fires. Test passes. No instantly tool exists yet —
        gate is proven safe before the tools are built.

Slice 4: "Agent can research market pain points online"
→ Value: Agent searches the web during Phase 2 discovery — finds how the market
         frames the problem before writing outreach copy.
→ Code: tools/web/web.search/tool.ts — Brave Search API
          input: { query: string, count?: number (default 5) }
          output: { results: [{ title, url, description }] }
          onError: 401 → auth_error, 429 → rate_limit_error
        tools/web/web.search/prompt.md
        workflows/sales_outreach/README.md — full agent instructions
          (phases 1-5, Apollo protocol, session usage, resume logic)
        workflows/sales_outreach/tools/web.search/run — bash shim
        workflows/sales_outreach/tools/web.search/README.md
        Unit test: mock Brave API, verify result mapping + error handling.
→ Done: printf '{"query":"B2B SaaS pain points 2025"}' |
          workflows/sales_outreach/tools/web.search/run
        returns results.

Slice 5: "Agent can build a prospect list of real target companies and contacts"
→ Value: Agent finds companies matching the ICP, then finds people at those
         companies. Human approves the list before any email is sent.
→ Code: tools/apollo/apollo.search_companies/tool.ts
          input: { industries?, employee_count_min?, employee_count_max?,
                   locations?, keywords?, page? }
          output: { companies: [{ id, name, domain, industry,
                   estimated_employee_count }], total_count, has_more }
        tools/apollo/apollo.search_people/tool.ts
          input: { organization_ids: string[], titles?, page? }
          output: { people: [{ id, first_name, last_name, email, title,
                   organization_name }], total_count, has_more }
        Both shims under workflows/sales_outreach/tools/
        Unit tests: mock Apollo, test 401 → auth_error, 429 → rate_limit_error,
        empty results (agent must ask user to widen ICP, not proceed to Instantly).
→ Riskiest assumption: Apollo returns emails directly without enrichment.
  Validate with a real API call before finalising output schema.
→ Done: Company search → people search scoped by company IDs works end-to-end.

Slice 6: "Agent creates a real campaign and uploads leads with approval at each step"
→ Value: Full outreach cycle works. Agent drafts, human approves, campaign goes live.
→ Code: tools/instantly/instantly.create_campaign/tool.ts  (destructive: true)
          input: { name, schedule_from?, schedule_to?, timezone? }
          output: { campaign_id, name, status }
          On success: writes campaign_id to session file (Slice 2 helpers)
          onError: campaign name conflict → clear message
        tools/instantly/instantly.add_leads/tool.ts  (destructive: true)
          input: { campaign_id, leads: [{ email, first_name, last_name,
                   company_name }] }
          Batches 500 leads internally. skip_if_in_campaign: true always set.
          output: { leads_uploaded, already_in_campaign, invalid_email_count,
                    total_sent }
          Partial failure: reports count + error, never silently succeeds.
        Both shims under workflows/sales_outreach/tools/
        Unit tests: gate fires, campaign_id persisted to session,
        partial import failure surfaced.
→ Riskiest assumption: add_leads is safe to retry. It is — only because we
  set skip_if_in_campaign: true explicitly.
→ Done: create_campaign (approval) → campaign_id in session →
        add_leads (approval) → partial failures visible.

Slice 7: "Full sales workflow runs end-to-end from scratch"
→ Value: We know the whole thing works together, not just in unit tests.
→ Code: Run tsx cli.ts with a real test target.
        Verify all 5 phases in sequence.
        Kill mid-run → restart → confirm resumes at Phase 4, skips Phase 3 HITL.
        Fix any integration issues found.
→ Done: Full workflow completes. Resume works. No orphan campaigns from test run.

Slice 8: "Agent can clean up an orphan campaign after add_leads is denied"
→ Value: Denying add_leads no longer leaks a campaign in Instantly forever.
→ Code: tools/instantly/instantly.delete_campaign/tool.ts  (destructive: true)
          input: { campaign_id }
          output: { deleted: boolean }
        Shim under workflows/sales_outreach/tools/
        Update workflow README: agent offers delete when add_leads denied
        and session has a campaignId.
→ Done: Agent surfaces delete offer on denial. Campaign is cleaned up.
```

---

## Validation Checklist (per slice)

- [ ] Can I ship this slice without the next one?
- [ ] Does it provide user value on its own?
- [ ] Can I test it without faking the whole system?
- [ ] Will it take less than 1 day?

---

## Out of Scope

- manifest.destructive gate in runDeclaredTool — TODOS.md P1
- Thread inspector — separate workstream
- Multiple sales workflows — validate one first
- Apollo pagination UI — agent asks user to narrow ICP if total_count is large
