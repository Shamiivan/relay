---
intent: web.fetch
description: Fetch a URL and return its full content as clean plain text. Best for reading a specific page in full.
shared_tool: tools/web/web.fetch
mutates: false
destructive: false
fields:
  url: "string: The https:// URL to fetch"
  maxChars: "number: Maximum characters to return, from 1000 to 50000 (default 20000)"
returns:
  url: "string: Fetched URL"
  title: "string: Returned title value"
  content: "string: Cleaned plain-text content"
  truncated: "boolean: True when the content was shortened"
---
`web.fetch` fetches a URL and returns its full content as clean plain text. Best for reading a specific page in full.

Safety: read-only external fetch. No records are created, updated, or deleted.

This workflow exposes the shared `tools/web/web.fetch` implementation; inputs and outputs are identical.

## Example

```bash
printf '{"url":"https://example.com/about"}' | workflows/sales_prospect_research/tools/web.fetch/run
```
