---
intent: instantly.campaign.searchByContact
description: Search Instantly campaigns by lead email address.
shared_tool: tools/instantly/campaign/instantly.campaign.searchByContact
prompt_ref: tools/instantly/campaign/instantly.campaign.searchByContact/prompt.md
mutates: false
destructive: false
fields:
  leadEmail: "string(email): Lead email address"
  limit: "number: Maximum campaigns to return, from 1 to 100 (default 10)"
  startingAfter: "string: Pagination cursor"
returns:
  campaigns: "Campaign[]: Normalized campaign records"
  nextStartingAfter: "string: Cursor for the next page when present"
---
`instantly.campaign.searchByContact` searches Instantly campaigns by lead email address.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.searchByContact` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.searchByContact/prompt.md` for deeper examples and operating guidance.
