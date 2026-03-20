---
intent: apollo.contact.bulkUpdate
description: Bulk update Apollo contacts.
shared_tool: tools/apollo/apollo.contact.bulkUpdate
prompt_ref: tools/apollo/apollo.contact.bulkUpdate/prompt.md
mutates: true
destructive: true
destructive_reason: Updates live Apollo contact records in bulk.
fields:
  body: "object: Native Apollo contacts/bulk_update request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.contact.bulkUpdate` bulk updates Apollo contacts.

Safety: destructive mutation. Updates live Apollo contact records in bulk.

This workflow exposes the shared `tools/apollo/apollo.contact.bulkUpdate` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.contact.bulkUpdate/prompt.md` for deeper examples and operating guidance.
