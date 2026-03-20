# Instantly Campaign Search Implementation

Date: 2026-03-19

## Done

- Added a thin shared Instantly HTTP boundary in `tools/instantly/lib/client.ts`
- Added explicit Instantly error types in `tools/instantly/lib/errors.ts`
- Implemented `instantly.campaign.search` in `tools/instantly/campaign/instantly.campaign.search/tool.ts`
- Expanded `instantly.campaign.search` to stay resource-native rather than introducing a generic Instantly request tool
- Implemented `instantly.account.search` in `tools/instantly/account/instantly.account.search/tool.ts`
- Implemented `instantly.email.search` in `tools/instantly/email/instantly.email.search/tool.ts`
- Implemented `instantly.lead.add` in `tools/instantly/lead/instantly.lead.add/tool.ts`
- Added workflow shim and docs under `workflows/sales_prospect_research/tools/instantly.campaign.search/`
- Added workflow shims and docs for:
  - `instantly.account.search`
  - `instantly.email.search`
  - `instantly.lead.add`
- Updated `workflows/sales_prospect_research/README.md` to expose the new tool

## Boundary coverage added

- bearer auth header
- base URL override
- query parameter encoding
- missing `INSTANTLY_API_KEY`
- fetch unavailable
- invalid tool input rejected by Zod
- upstream `401` / `429` error mapping
- malformed upstream JSON
- stdio process envelope via workflow shim
- JSON request body encoding for write tools
- endpoint-complete argument coverage for current Instantly tools instead of minimal subsets

## Verification

Passed:

```bash
node --import tsx --test tools/instantly/**/*.test.ts
pnpm check
```

Live smoke checks passed:

```bash
printf '{"limit":1}' | workflows/sales_prospect_research/tools/instantly.campaign.search/run
printf '{"limit":1}' | workflows/sales_prospect_research/tools/instantly.account.search/run
printf '{"limit":1}' | workflows/sales_prospect_research/tools/instantly.email.search/run
```

Notes:
- `instantly.email.search` needed one live-shape correction after the first smoke test. The real API returns `lead`, `eaccount`, and numeric `is_unread`.
- `instantly.lead.add` was not executed live because it creates data.

## Next likely slice

If this shape holds up, add the next small tools against the same boundary:
- `instantly.campaign.get`
- `instantly.account.get`
- `instantly.email.get`

Do not add a generic catch-all Instantly request tool unless a real workflow forces it.
