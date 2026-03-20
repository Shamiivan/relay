---
intent: instantly.campaign.pause
description: Pause an Instantly campaign.
shared_tool: tools/instantly/campaign/instantly.campaign.pause
prompt_ref: tools/instantly/campaign/instantly.campaign.pause/prompt.md
mutates: true
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID"
returns:
  campaign: "Campaign: Normalized campaign record"
---
`instantly.campaign.pause` pauses an Instantly campaign.

Safety: mutates state. Run only when the requested change is explicit.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.pause` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.pause/prompt.md` for deeper examples and operating guidance.
