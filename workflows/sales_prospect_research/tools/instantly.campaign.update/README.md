---
intent: instantly.campaign.update
description: Patch an existing Instantly campaign using the API v2 campaigns endpoint.
shared_tool: tools/instantly/campaign/instantly.campaign.update
prompt_ref: tools/instantly/campaign/instantly.campaign.update/prompt.md
mutates: true
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID"
returns:
  campaign: "Campaign: Normalized campaign record"
---
`instantly.campaign.update` patches an existing Instantly campaign using the API v2 campaigns endpoint.

Safety: mutates state. Run only when the requested change is explicit.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.update` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.update/prompt.md` for deeper examples and operating guidance.
