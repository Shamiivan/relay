---
intent: apollo.organization.search
description: Search Apollo organizations using the direct organizations search endpoint.
shared_tool: tools/apollo/apollo.organization.search
prompt_ref: tools/apollo/apollo.organization.search/prompt.md
mutates: false
destructive: false
fields:
  body: "object: Native Apollo organizations/search request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.organization.search` searches Apollo organizations using the direct organizations search endpoint.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.organization.search` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.organization.search/prompt.md` for deeper examples and operating guidance.
