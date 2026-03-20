---
intent: apollo.organization.show
description: Fetch a single Apollo organization record by ID or native show arguments.
shared_tool: tools/apollo/apollo.organization.show
prompt_ref: tools/apollo/apollo.organization.show/prompt.md
mutates: false
destructive: false
fields:
  id: "string: Optional Apollo organization ID alias"
  body: "object: Native Apollo organizations/show request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.organization.show` fetches a single Apollo organization record by ID or native show arguments.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.organization.show` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.organization.show/prompt.md` for deeper examples and operating guidance.
