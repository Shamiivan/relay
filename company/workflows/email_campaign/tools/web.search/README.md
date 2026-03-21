---
intent: web.search
description: Search the web for supporting market or company context.
shared_tool: tools/web/web.search
mutates: false
destructive: false
fields:
  query: "string: Search query"
returns:
  ok: "boolean: True when search succeeds"
  results: "array: Search results"
---

`web.search` exposes the shared web search tool inside the `email_campaign` workflow.

Use it only when the current campaign needs external evidence or a current company signal.

## Example

```bash
printf '%s\n' '{"query":"service business billing workflow problems operations manager hiring growth"}' | company/workflows/email_campaign/tools/web.search/run
```
