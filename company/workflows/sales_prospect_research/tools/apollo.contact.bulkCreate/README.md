---
intent: apollo.contact.bulkCreate
description: Bulk create Apollo contacts.
shared_tool: tools/apollo/apollo.contact.bulkCreate
prompt_ref: tools/apollo/apollo.contact.bulkCreate/prompt.md
mutates: true
destructive: true
destructive_reason: Creates live Apollo contact records and may create duplicates.
fields:
  body: "object: Native Apollo contacts/bulk_create request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.contact.bulkCreate` bulk creates Apollo contacts.

Safety: destructive mutation. Creates live Apollo contact records and may create duplicates.

This workflow exposes the shared `tools/apollo/apollo.contact.bulkCreate` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.contact.bulkCreate/prompt.md` for deeper examples and operating guidance.
