---
intent: instantly.campaign.countLaunched
description: Get the count of launched Instantly campaigns.
shared_tool: tools/instantly/campaign/instantly.campaign.countLaunched
prompt_ref: tools/instantly/campaign/instantly.campaign.countLaunched/prompt.md
mutates: false
destructive: false
fields: {}
returns:
  count: "number: Count returned by the operation"
---
`instantly.campaign.countLaunched` gets the count of launched Instantly campaigns.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.countLaunched` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.countLaunched/prompt.md` for deeper examples and operating guidance.
