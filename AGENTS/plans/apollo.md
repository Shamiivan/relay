---
status: ACTIVE
created: 2026-03-19
source-verified: 2026-03-19
---
# Plan: Apollo Tool Coverage

## Goal

Implement the Apollo API surface this sales agency workflow actually needs in Relay:

- Prospect search
- Person and company enrichment
- CRM-style account and contact sync
- Report and metadata utilities

The intent is broad Apollo tool coverage for outbound sales work, while still following the existing `defineTool` pattern, workflow shims, boundary tests, and typed JSON outputs.

---

## Scope

### Prospect Search

Already present in repo:

- `apollo.search_companies` -> `POST /api/v1/mixed_companies/search`
- `apollo.search_people` -> `POST /api/v1/mixed_people/api_search`

Still required for complete search coverage:

- `apollo.organization.search` -> `POST /api/v1/organizations/search`
- `apollo.organization.topPeople` -> `POST /api/v1/mixed_people/organization_top_people`
- `apollo.organization.jobPostings` -> `POST /api/v1/organizations/job_postings`

### Read And Match

Required read and matching tools:

- `apollo.person.show` -> `POST /api/v1/people/show`
- `apollo.person.match` -> `POST /api/v1/people/match`
- `apollo.person.bulkMatch` -> `POST /api/v1/people/bulk_match`
- `apollo.organization.show` -> `POST /api/v1/organizations/show`

### Organization Enrichment

Required organization enrichment tools:

- `apollo.organization.enrich` -> `POST /api/v1/organizations/enrich`
- `apollo.organization.bulkEnrich` -> `POST /api/v1/organizations/bulk_enrich`

### CRM Sync

Required CRM-facing tools:

- `apollo.contact.bulkCreate` -> `POST /api/v1/contacts/bulk_create`
- `apollo.contact.bulkUpdate` -> `POST /api/v1/contacts/bulk_update`
- `apollo.account.bulkCreate` -> `POST /api/v1/accounts/bulk_create`

### Reporting And Metadata

Required utility tools:

- `apollo.report.sync` -> `POST /api/v1/reports/sync_report`
- `apollo.field.create` -> `POST /api/v1/fields/create`

---

## Delivery Order

Build in this order:

1. Finish Prospect Search
2. Add Read And Match
3. Add Organization Enrichment
4. Add CRM Sync
5. Add Reporting And Metadata

Why this order:

- Search is the core motion for a sales agency.
- Read and match tools turn broad search output into usable person and company records.
- Enrichment is the next step once search quality is stable.
- CRM sync is mutating and higher-risk, so it should come after read paths are proven.
- Reporting and metadata are useful, but they do not unblock prospecting.

---

## Naming And Structure

Follow the existing repo pattern:

- code under `tools/apollo/<resource>/apollo.<resource>.<operation>/`
- prompt in `prompt.md`
- tests in `tool.test.ts`
- optional process boundary test where a workflow shim exists
- workflow shim under `workflows/sales_prospect_research/tools/<tool-name>/`

Use capability labels consistently:

- `search` for list/filter endpoints
- `read` for single fetch, match, enrich, or report retrieval
- `create` for POST mutations that create records or fields
- `update` for POST/patch-style updates to existing contacts

Set `destructive: true` for:

- `apollo.contact.bulkCreate`
- `apollo.contact.bulkUpdate`
- `apollo.account.bulkCreate`
- `apollo.field.create`

These are external mutations in a sales-agency system and should be approval-gated once the in-tool approval path exists.

---

## Shared Implementation Rules

- Reuse `tools/apollo/lib/client.ts` for HTTP transport.
- Reuse and expand shared schemas in `tools/apollo/lib/` instead of duplicating response shapes per tool.
- Apollo auth uses `X-Api-Key`, not `Authorization: Bearer`.
- Keep outputs typed and minimal. Return state, not prose.
- Preserve native Apollo selectors and argument names where possible, with camelCase input mapping only when it materially improves Relay ergonomics.
- Keep `onError` behavior consistent:
  - `401` and `403` -> `auth_error`
  - `404` -> `not_found`
  - `429` -> `rate_limit_error`
  - malformed upstream payload -> `external_error`
  - Zod input failures -> `validation`

---

## Sales Agency Constraints

This provider is being used for sales-agency work, not generic CRM administration.

That means:

- prioritize company search, people search, and enrichment before CRM sync
- optimize outputs for target-account selection and prospect handoff
- do not assume search endpoints expose unlocked emails
- prefer tools that help with list building, qualification, and contact resolution
- keep mutating CRM/account tools narrow and approval-gated

Recommended agency flow:

1. `apollo.search_companies`
2. `apollo.search_people` or `apollo.organization.topPeople`
3. `apollo.person.match` or `apollo.person.bulkMatch`
4. `apollo.organization.enrich` when company detail is needed
5. `apollo.contact.bulkCreate` or `apollo.account.bulkCreate` only after approval

---

## Test Standard

Every new tool must have boundary-first tests covering:

- happy path response mapping
- nullable field stability
- auth failure mapping
- rate limit mapping
- malformed upstream payload handling
- input validation before network call

Add endpoint-specific cases where relevant:

- required one-of argument groups
- bulk payload limits
- empty result sets
- top-level vs pagination-nested count fields
- search results that omit optional enrichment fields
- mutation endpoints that partially succeed

Run after each slice:

- targeted Node test run for the touched tools
- full typecheck
- one live Apollo smoke test against the real endpoint when credentials are available

---

## Per-Resource Checklist

### Slice A: Prospect Search Completion

- [x] add `apollo.search_companies`
- [x] add `apollo.search_people`
- [ ] add `apollo.organization.search`
- [ ] add `apollo.organization.topPeople`
- [ ] add `apollo.organization.jobPostings`
- [ ] add missing workflow shims for all search tools
- [ ] add tool tests
- [ ] run typecheck and search test suite

### Slice B: Read And Match

- [ ] add `apollo.person.show`
- [ ] add `apollo.person.match`
- [ ] add `apollo.person.bulkMatch`
- [ ] add `apollo.organization.show`
- [ ] add workflow shims
- [ ] add tool tests
- [ ] run typecheck and read/match test suite

### Slice C: Organization Enrichment

- [ ] add `apollo.organization.enrich`
- [ ] add `apollo.organization.bulkEnrich`
- [ ] add workflow shims
- [ ] add tool tests
- [ ] run typecheck and enrichment test suite

### Slice D: CRM Sync

- [ ] add `apollo.contact.bulkCreate`
- [ ] add `apollo.contact.bulkUpdate`
- [ ] add `apollo.account.bulkCreate`
- [ ] mark mutating tools destructive
- [ ] add workflow shims
- [ ] add tool tests
- [ ] run typecheck and CRM sync test suite

### Slice E: Reporting And Metadata

- [ ] add `apollo.report.sync`
- [ ] add `apollo.field.create`
- [ ] add workflow shims
- [ ] add tool tests
- [ ] run typecheck and utility test suite
