---
intent: apollo.person.match
description: Match a single person using Apollo's direct people match endpoint.
shared_tool: tools/apollo/apollo.person.match
prompt_ref: tools/apollo/apollo.person.match/prompt.md
mutates: false
destructive: false
fields:
  body: "object: Native Apollo people/match request body"
returns:
  response: "object: Native provider response payload"
---
`apollo.person.match` matches a single person using Apollo's direct people match endpoint.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.person.match` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.person.match/prompt.md` for deeper examples and operating guidance.
