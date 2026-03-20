---
intent: apollo.report.sync
description: Run Apollo report sync using the direct sync_report endpoint.
shared_tool: tools/apollo/apollo.report.sync
prompt_ref: tools/apollo/apollo.report.sync/prompt.md
mutates: false
destructive: false
fields:
  body: "object: Native Apollo reports/sync_report request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.report.sync` runs Apollo report sync using the direct sync_report endpoint.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.report.sync` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.report.sync/prompt.md` for deeper examples and operating guidance.
