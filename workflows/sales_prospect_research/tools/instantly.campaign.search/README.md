---
intent: instantly.campaign.search
description: Search and list Instantly campaigns using the API v2 campaigns endpoint.
shared_tool: tools/instantly/campaign/instantly.campaign.search
prompt_ref: tools/instantly/campaign/instantly.campaign.search/prompt.md
mutates: false
destructive: false
fields:
  limit: "number: Maximum campaigns to return, from 1 to 100 (default 10)"
  startingAfter: "string: Pagination cursor from a previous response"
  search: "string: Search by campaign name"
  tagIds: "string[]: Filter by Instantly tag IDs"
  aiSdrId: "string(uuid): Filter by AI SDR ID"
  status: "number: Campaign status filter (-99, -2, -1, 0, 1, 2, 3, 4)"
returns:
  campaigns: "Campaign[]: Normalized campaign records"
  nextStartingAfter: "string: Cursor for the next page when present"
---
`instantly.campaign.search` searches and lists Instantly campaigns using the API v2 campaigns endpoint.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.search` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.search/prompt.md` for deeper examples and operating guidance.

## Example

```bash
printf '{"search":"Summer Sale Campaign","limit":5}' | workflows/sales_prospect_research/tools/instantly.campaign.search/run
```
