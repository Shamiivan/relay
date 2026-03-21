---
intent: instantly.account.search
description: Inspect available Instantly sender accounts and health.
shared_tool: tools/instantly/account/instantly.account.search
mutates: false
destructive: false
fields:
  limit: "number: Maximum number of accounts to return"
returns:
  ok: "boolean: True when the search succeeds"
  items: "array: Matching sender accounts"
---

`instantly.account.search` exposes the shared Instantly account search tool inside the `email_campaign` workflow.

Use it before campaign creation to confirm healthy secondary sending domains.

## Example

```bash
printf '%s\n' '{"limit":10}' | company/workflows/email_campaign/tools/instantly.account.search/run
```

Sender lookup example:

```bash
printf '%s\n' '{"search":"ops@billing-workflows.co","limit":5}' | company/workflows/email_campaign/tools/instantly.account.search/run
```
