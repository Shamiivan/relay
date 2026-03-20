---
intent: instantly.campaign.variables.add
description: Add custom variables to an Instantly campaign.
shared_tool: tools/instantly/campaign/instantly.campaign.variables.add
prompt_ref: tools/instantly/campaign/instantly.campaign.variables.add/prompt.md
mutates: true
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID"
  variables: "string[]: Variable names to add"
returns:
  campaign: "Campaign: Normalized campaign record"
---
`instantly.campaign.variables.add` adds custom variables to an Instantly campaign.

Safety: mutates state. Run only when the requested change is explicit.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.variables.add` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.variables.add/prompt.md` for deeper examples and operating guidance.
