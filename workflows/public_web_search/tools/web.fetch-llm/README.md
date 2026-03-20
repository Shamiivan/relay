---
intent: web.fetch-llm
description: Search the web and return extracted snippets from multiple Brave-ranked pages in one call.
shared_tool: tools/web/web.fetch-llm
prompt_ref: tools/web/web.fetch-llm/prompt.md
mutates: false
destructive: false
fields:
  query: "string: The search query to fetch web content for"
  count: "number: Maximum number of URLs to retrieve content from, from 1 to 20 (default 5)"
returns:
  results: "WebFetchLlmResult[]: Ranked sources with url, title, and snippet arrays"
  query: "string: The original query used for retrieval"
---
`web.fetch-llm` searches the web and returns extracted snippets from multiple Brave-ranked pages in one call.

Use `web.fetch-llm` when you need quick evidence from several public sources without separate search and fetch steps. Avoid `web.fetch-llm` when you need the full text of one known page; use `web.fetch` for that.

Safety: read-only external query. No records are created, updated, or deleted.

This workflow exposes the shared `tools/web/web.fetch-llm` implementation; inputs and outputs are identical.

See `tools/web/web.fetch-llm/prompt.md` for retrieval strategy guidance.

## Examples

```bash
printf '{"query":"relay agent orchestration","count":5}' | workflows/public_web_search/tools/web.fetch-llm/run
```
