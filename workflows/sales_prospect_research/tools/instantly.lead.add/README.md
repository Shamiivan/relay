---
intent: instantly.lead.add
description: Add leads to an Instantly campaign or list using the API v2 bulk lead import endpoint.
shared_tool: tools/instantly/lead/instantly.lead.add
prompt_ref: tools/instantly/lead/instantly.lead.add/prompt.md
mutates: true
destructive: false
fields:
  campaignId: "string(uuid): Campaign ID to add leads to"
  listId: "string(uuid): List ID to add leads to"
  blocklistId: "string(uuid): Blocklist ID used for dedupe checks"
  assignedTo: "string(uuid): Default assignee for imported leads"
  verifyLeadsOnImport: "boolean: Verify leads on import"
  skipIfInWorkspace: "boolean: Skip leads already in workspace"
  skipIfInCampaign: "boolean: Skip leads already in campaign"
  skipIfInList: "boolean: Skip leads already in list"
  leads: "array: Leads to create; each lead requires email and may include personalization, website, lastName, firstName, companyName, phone, ltInterestStatus, plValueLead, assignedTo, customVariables"
returns:
  status: "string: Bulk lead import status"
  leadsCount: "number: Number of leads accepted for import"
  invalidEmailsCount: "number: Number of invalid emails rejected"
  duplicateEmailsCount: "number: Number of duplicate emails skipped"
  leads: "Lead[]: Lead records returned by the import endpoint"
---
`instantly.lead.add` adds leads to an Instantly campaign or list using the API v2 bulk lead import endpoint.

Provide exactly one of `campaignId` or `listId`.

Safety: mutates state. Run only when the requested change is explicit.

This workflow exposes the shared `tools/instantly/lead/instantly.lead.add` implementation; inputs and outputs are identical.

See `tools/instantly/lead/instantly.lead.add/prompt.md` for deeper examples and operating guidance.

## Example

```bash
printf '{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548","leads":[{"email":"ada@example.com","firstName":"Ada"}]}' | workflows/sales_prospect_research/tools/instantly.lead.add/run
```
