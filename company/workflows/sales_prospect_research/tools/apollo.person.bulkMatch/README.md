---
intent: apollo.person.bulkMatch
description: Bulk match multiple people using Apollo's people bulk match endpoint.
shared_tool: tools/apollo/apollo.person.bulkMatch
prompt_ref: tools/apollo/apollo.person.bulkMatch/prompt.md
mutates: false
destructive: false
fields:
  body: "object: Native Apollo people/bulk_match request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.person.bulkMatch` bulk matches multiple people using Apollo's people bulk match endpoint.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.person.bulkMatch` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.person.bulkMatch/prompt.md` for deeper examples and operating guidance.
