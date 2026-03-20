---
status: ACTIVE
created: 2026-03-19
source-verified: 2026-03-19
---
# Plan: Instantly Tool Coverage

## Goal

Implement the Instantly API surface we actually need in Relay:

- Campaign
- Lead
- Analytics
- Account
- Email

The intent is full tool coverage for these five Instantly resource families, following the existing `defineTool` pattern, workflow shims, boundary tests, and typed JSON outputs.

---

## Scope

### Campaign

Already present or partially present in repo:

- `instantly.campaign.search`
- `instantly.campaign.create`
- `instantly.campaign.update`
- `instantly.campaign.activate`
- `instantly.campaign.pause`
- `instantly.campaign.get`
- `instantly.campaign.delete`
- `instantly.campaign.searchByContact`
- `instantly.campaign.countLaunched`

Still required for complete campaign coverage:

- `instantly.campaign.duplicate` -> `POST /api/v2/campaigns/{id}/duplicate`
- `instantly.campaign.export` -> `POST /api/v2/campaigns/{id}/export`
- `instantly.campaign.share` -> `POST /api/v2/campaigns/{id}/share`
- `instantly.campaign.fromExport` -> `POST /api/v2/campaigns/{id}/from-export`
- `instantly.campaign.variables.add` -> `POST /api/v2/campaigns/{id}/variables`
- `instantly.campaign.sendingStatus` -> `GET /api/v2/campaigns/{id}/sending-status`

### Lead

Required lead tools:

- `instantly.lead.create` -> `POST /api/v2/leads`
- `instantly.lead.add` -> `POST /api/v2/leads/add`
- `instantly.lead.search` -> `POST /api/v2/leads/list`
- `instantly.lead.get` -> `GET /api/v2/leads/{id}`
- `instantly.lead.update` -> `PATCH /api/v2/leads/{id}`
- `instantly.lead.delete` -> `DELETE /api/v2/leads/{id}`
- `instantly.lead.deleteMany` -> `DELETE /api/v2/leads`
- `instantly.lead.merge` -> `POST /api/v2/leads/merge`
- `instantly.lead.updateInterestStatus` -> `POST /api/v2/leads/update-interest-status`
- `instantly.lead.move` -> `POST /api/v2/leads/move`

### Account

Already present:

- `instantly.account.search`

Required account tools:

- `instantly.account.create` -> `POST /api/v2/accounts`
- `instantly.account.get` -> `GET /api/v2/accounts/{email}`
- `instantly.account.update` -> `PATCH /api/v2/accounts/{email}`
- `instantly.account.delete` -> `DELETE /api/v2/accounts/{email}`
- `instantly.account.warmup.enable` -> `POST /api/v2/accounts/warmup/enable`
- `instantly.account.warmup.disable` -> `POST /api/v2/accounts/warmup/disable`
- `instantly.account.pause` -> `POST /api/v2/accounts/{email}/pause`
- `instantly.account.resume` -> `POST /api/v2/accounts/{email}/resume`
- `instantly.account.markFixed` -> `POST /api/v2/accounts/{email}/mark-fixed`
- `instantly.account.ctdStatus` -> `GET /api/v2/accounts/ctd/status`
- `instantly.account.move` -> `POST /api/v2/accounts/move`

### Email

Already present:

- `instantly.email.search`

Required email tools:

- `instantly.email.test` -> `POST /api/v2/emails/test`
- `instantly.email.reply` -> `POST /api/v2/emails/reply`
- `instantly.email.forward` -> `POST /api/v2/emails/forward`
- `instantly.email.get` -> `GET /api/v2/emails/{id}`
- `instantly.email.update` -> `PATCH /api/v2/emails/{id}`
- `instantly.email.delete` -> `DELETE /api/v2/emails/{id}`
- `instantly.email.countUnread` -> `GET /api/v2/emails/unread/count`
- `instantly.email.thread.markAsRead` -> `POST /api/v2/emails/threads/{thread_id}/mark-as-read`

### Analytics

Required analytics tools:

- `instantly.analytics.accounts.warmup` -> `POST /api/v2/accounts/warmup-analytics`
- `instantly.analytics.accounts.daily` -> `GET /api/v2/accounts/analytics/daily`
- `instantly.analytics.accounts.testVitals` -> `POST /api/v2/accounts/test/vitals`
- `instantly.analytics.campaigns.get` -> `GET /api/v2/campaigns/analytics`
- `instantly.analytics.campaigns.overview` -> `GET /api/v2/campaigns/analytics/overview`
- `instantly.analytics.campaigns.daily` -> `GET /api/v2/campaigns/analytics/daily`
- `instantly.analytics.campaigns.steps` -> `GET /api/v2/campaigns/analytics/steps`

---

## Delivery Order

Build in this order:

1. Finish Campaign
2. Finish Account
3. Finish Email
4. Add Analytics
5. Finish Lead

Why this order:

- Campaign is already mostly in flight and unblocks the immediate sales workflow.
- Account and Email are smaller and give us the shared primitives around sending infrastructure and unibox state.
- Analytics is read-only and lower risk once campaign/account schemas are understood.
- Lead is broader and has the most payload variation, background-job flows, and filtering complexity.

---

## Naming And Structure

Follow the existing repo pattern:

- code under `tools/instantly/<resource>/instantly.<resource>.<operation>/`
- prompt in `prompt.md`
- tests in `tool.test.ts`
- optional process boundary test where a workflow shim exists
- workflow shim under `workflows/sales_prospect_research/tools/<tool-name>/`

Use capability labels consistently:

- `search` for list/filter endpoints
- `read` for single fetch or counters
- `create` for POST mutations that create or initiate
- `update` for PATCH-like changes or non-create POST mutations
- `delete` for destructive deletes

Set `destructive: true` for:

- campaign delete
- account delete
- email delete
- lead delete
- lead deleteMany
- any create/update tool that causes irreversible external side effects where the user should approve first

---

## Shared Implementation Rules

- Reuse `tools/instantly/lib/client.ts` for HTTP transport.
- Reuse and expand shared schemas in `tools/instantly/lib/` instead of duplicating response shapes per tool.
- Keep outputs typed and minimal. Return state, not prose.
- Preserve native Instantly selectors and argument names where possible, with camelCase input mapping only when it materially improves Relay ergonomics.
- Keep `onError` behavior consistent:
  - `401` and `403` -> `auth_error`
  - `404` -> `not_found`
  - `429` -> `rate_limit_error`
  - malformed upstream payload -> `external_error`
  - Zod input failures -> `validation`

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

- mutually exclusive arguments
- required one-of argument groups
- empty result sets
- destructive delete acknowledgements
- background job response envelopes
- pagination cursor handling

Run after each slice:

- targeted Vitest for the touched tools
- full typecheck

---

## Per-Resource Checklist

### Slice A: Campaign Completion

- [ ] verify current partial tools match docs exactly
- [ ] add `instantly.campaign.duplicate`
- [ ] add `instantly.campaign.export`
- [ ] add `instantly.campaign.share`
- [ ] add `instantly.campaign.fromExport`
- [ ] add `instantly.campaign.variables.add`
- [ ] add `instantly.campaign.sendingStatus`
- [ ] add missing workflow shims for all campaign tools
- [ ] add tool tests
- [ ] run typecheck and campaign test suite

### Slice B: Account Completion

- [ ] add `instantly.account.create`
- [ ] add `instantly.account.get`
- [ ] add `instantly.account.update`
- [ ] add `instantly.account.delete`
- [ ] add `instantly.account.warmup.enable`
- [ ] add `instantly.account.warmup.disable`
- [ ] add `instantly.account.pause`
- [ ] add `instantly.account.resume`
- [ ] add `instantly.account.markFixed`
- [ ] add `instantly.account.ctdStatus`
- [ ] add `instantly.account.move`
- [ ] add workflow shims
- [ ] add tool tests
- [ ] run typecheck and account test suite

### Slice C: Email Completion

- [ ] add `instantly.email.test`
- [ ] add `instantly.email.reply`
- [ ] add `instantly.email.forward`
- [ ] add `instantly.email.get`
- [ ] add `instantly.email.update`
- [ ] add `instantly.email.delete`
- [ ] add `instantly.email.countUnread`
- [ ] add `instantly.email.thread.markAsRead`
- [ ] add workflow shims
- [ ] add tool tests
- [ ] run typecheck and email test suite

### Slice D: Analytics

- [ ] add `instantly.analytics.accounts.warmup`
- [ ] add `instantly.analytics.accounts.daily`
- [ ] add `instantly.analytics.accounts.testVitals`
- [ ] add `instantly.analytics.campaigns.get`
- [ ] add `instantly.analytics.campaigns.overview`
- [ ] add `instantly.analytics.campaigns.daily`
- [ ] add `instantly.analytics.campaigns.steps`
- [ ] add workflow shims
- [ ] add tool tests
- [ ] run typecheck and analytics test suite

### Slice E: Lead Completion

- [ ] reconcile `instantly.lead.add` against current docs path and payload
- [ ] add `instantly.lead.create`
- [ ] add `instantly.lead.search`
- [ ] add `instantly.lead.get`
- [ ] add `instantly.lead.update`
- [ ] add `instantly.lead.delete`
- [ ] add `instantly.lead.deleteMany`
- [ ] add `instantly.lead.merge`
- [ ] add `instantly.lead.updateInterestStatus`
- [ ] add `instantly.lead.move`
- [ ] add workflow shims
- [ ] add tool tests
- [ ] run typecheck and lead test suite

---

## Risks

- Instantly docs expose some endpoints under both older and newer route variants. We need to pin each tool to the current documented v2 path before wiring tests.
- Lead and analytics endpoints have the most schema breadth; over-modeling every field up front will slow delivery. Prefer stable, high-signal subsets for normalized output and preserve passthrough where needed.
- Some POST endpoints return background job envelopes rather than resource objects. Those should not be forced into resource-shaped outputs.

---

## Done Definition

This plan is complete when:

- every endpoint in the five target resource families has a corresponding Relay tool
- every tool has prompt metadata, typed input, typed output, and boundary tests
- workflow shims exist for each shipped tool
- typecheck passes
- the new tools follow the existing Instantly naming and error-handling conventions

---

## Sources

- https://developer.instantly.ai/getting-started/getting-started
- https://developer.instantly.ai/api/v2
- https://developer.instantly.ai/api/v2/account/list-account
- https://developer.instantly.ai/api/v2/campaign/duplicate
- https://developer.instantly.ai/api-v1-docs
