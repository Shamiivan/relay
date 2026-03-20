---
intent: instantly.campaign.delete
description: Delete an Instantly campaign by ID.
shared_tool: tools/instantly/campaign/instantly.campaign.delete
prompt_ref: tools/instantly/campaign/instantly.campaign.delete/prompt.md
mutates: true
destructive: true
destructive_reason: Deletes a live Instantly campaign.
fields:
  campaignId: "string(uuid): Campaign ID"
returns:
  deleted: "true: True when deletion succeeded"
  campaignId: "string: Campaign identifier"
---
`instantly.campaign.delete` deletes an Instantly campaign by ID.

Safety: destructive mutation. Deletes a live Instantly campaign.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.delete` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.delete/prompt.md` for deeper examples and operating guidance.
