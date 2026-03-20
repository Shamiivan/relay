---
intent: instantly.campaign.get
description: Get a single Instantly campaign by ID.
shared_tool: tools/instantly/campaign/instantly.campaign.get
prompt_ref: tools/instantly/campaign/instantly.campaign.get/prompt.md
mutates: false
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID"
returns:
  campaign: "Campaign: Normalized campaign record"
---
`instantly.campaign.get` gets a single Instantly campaign by ID.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.get` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.get/prompt.md` for deeper examples and operating guidance.
