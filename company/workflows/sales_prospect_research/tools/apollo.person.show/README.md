---
intent: apollo.person.show
description: Fetch a single Apollo person record by ID or native show arguments.
shared_tool: tools/apollo/apollo.person.show
prompt_ref: tools/apollo/apollo.person.show/prompt.md
mutates: false
destructive: false
fields:
  id: "string: Optional Apollo person ID alias"
  body: "object: Native Apollo people/show request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.person.show` fetches a single Apollo person record by ID or native show arguments.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.person.show` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.person.show/prompt.md` for deeper examples and operating guidance.
