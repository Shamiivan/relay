---
intent: web.search
description: Search the public web with Brave Search and return result titles, URLs, and snippets.
shared_tool: tools/web/web.search
mutates: false
destructive: false
fields:
  query: "string: The web search query to run"
  count: "number: Maximum results to return, from 1 to 20 (default 5)"
  offset: "number: Pagination offset, from 0 to 9 (default 0)"
returns:
  results: "WebSearchResult[]: Result records with title, url, and description"
  query: "string: Query used for the operation"
  moreResultsAvailable: "boolean: Returned moreResultsAvailable value"
---
`web.search` searches the public web with Brave Search and returns result titles, URLs, and snippets.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/web/web.search` implementation; inputs and outputs are identical.

## Example

```bash
printf '{"query":"B2B SaaS pain points","count":5}' | company/workflows/sales_prospect_research/tools/web.search/run
```
