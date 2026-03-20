---
intent: apollo.organization.bulkEnrich
description: Bulk enrich multiple organizations using Apollo's bulk enrich endpoint.
shared_tool: tools/apollo/apollo.organization.bulkEnrich
prompt_ref: tools/apollo/apollo.organization.bulkEnrich/prompt.md
mutates: false
destructive: false
fields:
  body: "object: Native Apollo organizations/bulk_enrich request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.organization.bulkEnrich` bulk enriches multiple organizations using Apollo's bulk enrich endpoint.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.organization.bulkEnrich` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.organization.bulkEnrich/prompt.md` for deeper examples and operating guidance.
