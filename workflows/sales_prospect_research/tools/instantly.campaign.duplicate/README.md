---
intent: instantly.campaign.duplicate
description: Duplicate an Instantly campaign by ID.
shared_tool: tools/instantly/campaign/instantly.campaign.duplicate
prompt_ref: tools/instantly/campaign/instantly.campaign.duplicate/prompt.md
mutates: true
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID to duplicate"
  name: "string: Optional name for the new campaign"
returns:
  campaign: "Campaign: Normalized campaign record"
---
`instantly.campaign.duplicate` duplicates an Instantly campaign by ID.

Safety: mutates state. Run only when the requested change is explicit.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.duplicate` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.duplicate/prompt.md` for deeper examples and operating guidance.
