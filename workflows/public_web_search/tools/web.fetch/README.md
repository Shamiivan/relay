---
intent: web.fetch
description: Fetch a URL and return its content as clean plain text
fields:
  url: "string: The https:// URL to fetch"
  maxChars: "number: Maximum characters to return, from 1000 to 50000 (default 20000)"
---
Fetch a single URL and return its full content as plain text with HTML stripped. Use this after web.search to read a page in full.

## Examples

```bash
printf '{"url":"https://example.com/about"}' | workflows/public_web_search/tools/web.fetch/run
printf '{"url":"https://example.com/article","maxChars":5000}' | workflows/public_web_search/tools/web.fetch/run
```
