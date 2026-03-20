---
intent: instantly.account.search
description: Search and list Instantly sending accounts using the API v2 accounts endpoint.
shared_tool: tools/instantly/account/instantly.account.search
prompt_ref: tools/instantly/account/instantly.account.search/prompt.md
mutates: false
destructive: false
fields:
  limit: "number: Maximum accounts to return, from 1 to 100 (default 10)"
  startingAfter: "string: Pagination cursor from a previous response"
  search: "string: Search by account email address"
  status: "number: Account status filter (1, 2, 3, -1, -2, -3)"
  providerCode: "number: Provider code filter (1, 2, 3, 4, 8)"
  tagIds: "string[]: Filter by Instantly account tag IDs"
returns:
  accounts: "Account[]: Normalized sending account records"
  nextStartingAfter: "string: Cursor for the next page when present"
---
`instantly.account.search` searches and lists Instantly sending accounts using the API v2 accounts endpoint.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/instantly/account/instantly.account.search` implementation; inputs and outputs are identical.

See `tools/instantly/account/instantly.account.search/prompt.md` for deeper examples and operating guidance.

## Example

```bash
printf '{"search":"sender@example.com","limit":5}' | workflows/sales_prospect_research/tools/instantly.account.search/run
```
