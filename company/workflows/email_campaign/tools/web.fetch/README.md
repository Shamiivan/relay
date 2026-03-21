---
intent: web.fetch
description: Fetch and summarize a single web page.
shared_tool: tools/web/web.fetch
mutates: false
destructive: false
fields:
  url: "string: URL to fetch"
returns:
  ok: "boolean: True when fetch succeeds"
  content: "string: Extracted page content"
---

`web.fetch` exposes the shared web page fetch tool inside the `email_campaign` workflow.

Use it for narrow market or company research when needed.

## Example

```bash
printf '%s\n' '{"url":"https://www.shopify.com/blog/invoicing"}' | company/workflows/email_campaign/tools/web.fetch/run
```
