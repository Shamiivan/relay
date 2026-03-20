---
intent: instantly.campaign.share
description: Share an Instantly campaign by ID.
shared_tool: tools/instantly/campaign/instantly.campaign.share
prompt_ref: tools/instantly/campaign/instantly.campaign.share/prompt.md
mutates: true
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID"
returns:
  shared: "true: True when the file is shared"
  campaignId: "string: Campaign identifier"
---
`instantly.campaign.share` shares an Instantly campaign by ID.

Safety: mutates state. Run only when the requested change is explicit.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.share` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.share/prompt.md` for deeper examples and operating guidance.
