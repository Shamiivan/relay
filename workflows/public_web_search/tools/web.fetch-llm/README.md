---
intent: web.fetch-llm
description: Search the web and retrieve pre-ranked content chunks via Brave LLM Context API. Combines search and extraction in one call.
shared_tool: tools/web/web.fetch-llm
mutates: false
destructive: false
fields:
  query: "string: The search query to fetch web content for"
  count: "number: Maximum number of URLs to retrieve content from, from 1 to 20 (default 5)"
returns:
  results: "WebFetchLlmResult[]: Ranked source records with url, title, and snippets"
  query: "string: Query used for the operation"
---
`web.fetch-llm` searches the web and retrieves pre-ranked content chunks via Brave LLM Context API. Combines search and extraction in one call.

Use `web.fetch-llm` when you need quick evidence from several public sources without separate search and fetch steps. Avoid `web.fetch-llm` when you need the full text of one known page; use `web.fetch` for that.
Safety: read-only external query. No records are created, updated, or deleted.
This workflow exposes the shared `tools/web/web.fetch-llm` implementation; inputs and outputs are identical.
See `tools/web/web.fetch-llm/prompt.md` for retrieval strategy guidance.

Safety: read-only external fetch. No records are created, updated, or deleted.

This workflow exposes the shared `tools/web/web.fetch-llm` implementation; inputs and outputs are identical.

## Example

```bash
printf '{"query":"relay agent orchestration","count":5}' | workflows/public_web_search/tools/web.fetch-llm/run
```
