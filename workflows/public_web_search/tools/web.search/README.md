---
intent: web.search
description: Search the public web with Brave Search and return normalized result records plus pagination metadata.
shared_tool: tools/web/web.search
prompt_ref: tools/web/web.search/prompt.md
mutates: false
destructive: false
fields:
  query: "string: The web search query to run"
  count: "number: Maximum results to return, from 1 to 20 (default 5)"
  offset: "number: Pagination offset, from 0 to 9 (default 0)"
returns:
  results: "WebSearchResult[]: Normalized results with title, url, and description"
  query: "string: The query Brave executed after normalization"
  moreResultsAvailable: "boolean: True when Brave reports another page of results"
---
`web.search` searches the public web with Brave Search and returns normalized results plus pagination metadata.

Use `web.search` when you need to discover relevant public URLs from a query. Avoid `web.search` when you already have a specific URL to read; use `web.fetch` instead.

Safety: read-only external query. No records are created, updated, or deleted.

This workflow exposes the shared `tools/web/web.search` implementation; inputs and outputs are identical.

See `tools/web/web.search/prompt.md` for query-writing guidance.

## Examples

```bash
printf '{"query":"B2B SaaS pain points","count":5}' | workflows/public_web_search/tools/web.search/run
```
