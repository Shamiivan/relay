---
intent: instantly.lead.add
description: Add leads to an Instantly campaign or list using API v2
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
---
Add leads to Instantly in bulk.

Provide exactly one of `campaignId` or `listId`.

## Examples

```bash
printf '{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548","leads":[{"email":"ada@example.com","firstName":"Ada"}]}' | workflows/sales_prospect_research/tools/instantly.lead.add/run
printf '{"listId":"019c0e38-c5be-70d5-b730-fdd27bea4548","skipIfInWorkspace":true,"leads":[{"email":"grace@example.com","customVariables":{"role":"founder"}}]}' | workflows/sales_prospect_research/tools/instantly.lead.add/run
```
