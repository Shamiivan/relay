---
intent: instantly.campaign.activate
description: Activate or resume an Instantly campaign.
shared_tool: tools/instantly/campaign/instantly.campaign.activate
prompt_ref: tools/instantly/campaign/instantly.campaign.activate/prompt.md
mutates: true
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID"
returns:
  campaign: "Campaign: Normalized campaign record"
---
`instantly.campaign.activate` activates or resume an Instantly campaign.

Safety: mutates state. Run only when the requested change is explicit.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.activate` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.activate/prompt.md` for deeper examples and operating guidance.
