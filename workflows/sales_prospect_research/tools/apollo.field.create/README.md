---
intent: apollo.field.create
description: Create an Apollo custom field.
shared_tool: tools/apollo/apollo.field.create
prompt_ref: tools/apollo/apollo.field.create/prompt.md
mutates: true
destructive: true
destructive_reason: Creates a live Apollo custom field.
fields:
  body: "object: Native Apollo fields/create request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.field.create` creates an Apollo custom field.

Safety: destructive mutation. Creates a live Apollo custom field.

This workflow exposes the shared `tools/apollo/apollo.field.create` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.field.create/prompt.md` for deeper examples and operating guidance.
