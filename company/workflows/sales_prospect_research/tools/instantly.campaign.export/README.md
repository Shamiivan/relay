---
intent: instantly.campaign.export
description: Export an Instantly campaign into its JSON representation.
shared_tool: tools/instantly/campaign/instantly.campaign.export
prompt_ref: tools/instantly/campaign/instantly.campaign.export/prompt.md
mutates: false
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID"
returns:
  campaign: "Campaign: Normalized campaign record"
---
`instantly.campaign.export` exports an Instantly campaign into its JSON representation.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.export` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.export/prompt.md` for deeper examples and operating guidance.
