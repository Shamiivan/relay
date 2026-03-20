---
intent: apollo.organization.jobPostings
description: Fetch Apollo organization job postings for account research.
shared_tool: tools/apollo/apollo.organization.jobPostings
prompt_ref: tools/apollo/apollo.organization.jobPostings/prompt.md
mutates: false
destructive: false
fields:
  organizationId: "string: Optional single organization ID alias"
  organizationIds: "string[]: Optional organization ID alias list"
  body: "object: Additional native Apollo organizations/job_postings request fields"
returns:
  response: "object: Native provider response payload"
---
`apollo.organization.jobPostings` fetches Apollo organization job postings for account research.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.organization.jobPostings` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.organization.jobPostings/prompt.md` for deeper examples and operating guidance.
