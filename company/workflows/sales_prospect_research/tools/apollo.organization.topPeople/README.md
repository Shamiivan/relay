---
intent: apollo.organization.topPeople
description: Fetch top Apollo contacts associated with one or more organizations.
shared_tool: tools/apollo/apollo.organization.topPeople
prompt_ref: tools/apollo/apollo.organization.topPeople/prompt.md
mutates: false
destructive: false
fields:
  organizationId: "string: Optional single organization ID alias"
  organizationIds: "string[]: Optional organization ID alias list"
  body: "object: Additional native Apollo organization_top_people request fields"
returns:
  response: "object: Native provider response payload"
---
`apollo.organization.topPeople` fetches top Apollo contacts associated with one or more organizations.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.organization.topPeople` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.organization.topPeople/prompt.md` for deeper examples and operating guidance.
