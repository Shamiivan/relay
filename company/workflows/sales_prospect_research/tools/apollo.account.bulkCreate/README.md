---
intent: apollo.account.bulkCreate
description: Bulk create Apollo accounts.
shared_tool: tools/apollo/apollo.account.bulkCreate
prompt_ref: tools/apollo/apollo.account.bulkCreate/prompt.md
mutates: true
destructive: true
destructive_reason: Creates live Apollo account records and may create duplicates.
fields:
  body: "object: Native Apollo accounts/bulk_create request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.account.bulkCreate` bulk creates Apollo accounts.

Safety: destructive mutation. Creates live Apollo account records and may create duplicates.

This workflow exposes the shared `tools/apollo/apollo.account.bulkCreate` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.account.bulkCreate/prompt.md` for deeper examples and operating guidance.
