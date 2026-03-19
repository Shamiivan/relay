---
intent: web.search
description: Search the public web using Brave Search
fields:
  query: "string: The web search query to run"
  count: "number: Maximum results to return, from 1 to 20 (default 5)"
  offset: "number: Pagination offset, from 0 to 9 (default 0)"
---
Search the public web and return result titles, URLs, and snippets.

## Examples

```bash
printf '{"query":"B2B SaaS pain points","count":5}' | workflows/sales_outreach/tools/web.search/run
printf '{"query":"site:github.com relay agent","count":3,"offset":1}' | workflows/sales_outreach/tools/web.search/run
```
