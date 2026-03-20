---
intent: web.fetch
description: Fetch one public HTTPS URL and return its cleaned page text with title and truncation status.
shared_tool: tools/web/web.fetch
prompt_ref: tools/web/web.fetch/prompt.md
mutates: false
destructive: false
fields:
  url: "string: The https:// URL to fetch"
  maxChars: "number: Maximum characters to return, from 1000 to 50000 (default 20000)"
returns:
  url: "string: The fetched URL"
  title: "string: The HTML title when present"
  content: "string: Cleaned plain-text page content"
  truncated: "boolean: True when content was shortened to respect maxChars"
---
`web.fetch` fetches one public HTTPS URL and returns cleaned page text with title and truncation status.

Use `web.fetch` after `web.search` when you already know the page you want to read in full. Avoid `web.fetch` for private hosts, non-HTTPS URLs, or when you need snippets from several pages at once; use `web.fetch-llm` for the multi-source case.

Safety: read-only external fetch. No records are created, updated, or deleted.

This workflow exposes the shared `tools/web/web.fetch` implementation; inputs and outputs are identical.

See `tools/web/web.fetch/prompt.md` for extraction constraints and URL guidance.

## Examples

```bash
printf '{"url":"https://example.com/about"}' | workflows/public_web_search/tools/web.fetch/run
```
