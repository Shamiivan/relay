---
intent: apollo.organization.enrich
description: Enrich one organization using Apollo's organization enrich endpoint.
shared_tool: tools/apollo/apollo.organization.enrich
prompt_ref: tools/apollo/apollo.organization.enrich/prompt.md
mutates: false
destructive: false
fields:
  body: "object: Native Apollo organizations/enrich request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.organization.enrich` enriches one organization using Apollo's organization enrich endpoint.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.organization.enrich` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.organization.enrich/prompt.md` for deeper examples and operating guidance.
