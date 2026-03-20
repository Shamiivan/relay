---
intent: instantly.campaign.fromExport
description: Create an Instantly campaign from a shared campaign export.
shared_tool: tools/instantly/campaign/instantly.campaign.fromExport
prompt_ref: tools/instantly/campaign/instantly.campaign.fromExport/prompt.md
mutates: true
destructive: false
fields:
  campaignId: "string(uuid): Shared campaign ID"
returns:
  campaign: "Campaign: Normalized campaign record"
---
`instantly.campaign.fromExport` creates an Instantly campaign from a shared campaign export.

Safety: mutates state. Run only when the requested change is explicit.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.fromExport` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.fromExport/prompt.md` for deeper examples and operating guidance.
