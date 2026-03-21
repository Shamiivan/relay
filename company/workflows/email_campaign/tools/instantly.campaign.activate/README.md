---
intent: instantly.campaign.activate
description: Activate an Instantly campaign so it can begin sending.
shared_tool: tools/instantly/campaign/instantly.campaign.activate
mutates: true
destructive: true
fields:
  campaignId: "string: Instantly campaign id"
returns:
  ok: "boolean: True when activation succeeds"
---

`instantly.campaign.activate` exposes the shared Instantly campaign activation tool inside the `email_campaign` workflow.

Use only after explicit human approval.

## Example

```bash
printf '%s\n' '{"campaignId":"immediate-billing-na-ops-q2"}' | company/workflows/email_campaign/tools/instantly.campaign.activate/run
```
