---
intent: instantly.account.search
description: Search Instantly sending accounts using API v2
fields:
  limit: "number: Maximum accounts to return, from 1 to 100 (default 10)"
  startingAfter: "string: Pagination cursor from a previous response"
  search: "string: Search by account email address"
  status: "number: Account status filter (1, 2, 3, -1, -2, -3)"
  providerCode: "number: Provider code filter (1, 2, 3, 4, 8)"
  tagIds: "string[]: Filter by Instantly account tag IDs"
---
Search and list sending accounts from Instantly API v2.

## Examples

```bash
printf '{"search":"sender@example.com","limit":5}' | workflows/sales_prospect_research/tools/instantly.account.search/run
printf '{"providerCode":2,"tagIds":["tag-1","tag-2"],"limit":10}' | workflows/sales_prospect_research/tools/instantly.account.search/run
```
