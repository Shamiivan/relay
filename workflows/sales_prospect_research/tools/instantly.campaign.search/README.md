---
intent: instantly.campaign.search
description: Search Instantly campaigns using API v2
fields:
  limit: "number: Maximum campaigns to return, from 1 to 100 (default 10)"
  startingAfter: "string: Pagination cursor from a previous response"
  search: "string: Search by campaign name"
  tagIds: "string[]: Filter by Instantly tag IDs"
  aiSdrId: "string(uuid): Filter by AI SDR ID"
  status: "number: Campaign status filter (-99, -2, -1, 0, 1, 2, 3, 4)"
---
Search and list campaigns from Instantly API v2.

## Examples

```bash
printf '{"search":"Summer Sale Campaign","limit":5}' | workflows/sales_prospect_research/tools/instantly.campaign.search/run
printf '{"status":1,"limit":10}' | workflows/sales_prospect_research/tools/instantly.campaign.search/run
```
