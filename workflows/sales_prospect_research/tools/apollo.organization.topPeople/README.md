---
intent: apollo.organization.topPeople
description: Fetch top people for an Apollo organization
fields:
  organizationId: "string: Optional single organization ID alias"
  organizationIds: "string[]: Optional organization ID alias list"
  body: "object: Additional native Apollo organization_top_people request fields"
---
Fetch top Apollo people for one or more organizations.
