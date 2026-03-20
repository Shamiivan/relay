---
intent: instantly.campaign.sendingStatus
description: Inspect an Instantly campaign sending status and optional AI summary.
shared_tool: tools/instantly/campaign/instantly.campaign.sendingStatus
prompt_ref: tools/instantly/campaign/instantly.campaign.sendingStatus/prompt.md
mutates: false
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID"
  withAiSummary: "boolean: Include Instantly AI summary"
returns:
  diagnostics: "Diagnostic[]: Sending-status diagnostics"
  summary: "object: AI-generated sending-status summary when requested"
---
`instantly.campaign.sendingStatus` inspects an Instantly campaign sending status and optional AI summary.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/instantly/campaign/instantly.campaign.sendingStatus` implementation; inputs and outputs are identical.

See `tools/instantly/campaign/instantly.campaign.sendingStatus/prompt.md` for deeper examples and operating guidance.
