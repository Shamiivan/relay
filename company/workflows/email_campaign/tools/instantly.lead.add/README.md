---
intent: instantly.lead.add
description: Add leads to an Instantly campaign.
shared_tool: tools/instantly/lead/instantly.lead.add
mutates: true
destructive: true
fields:
  campaign: "string: Instantly campaign id"
  leads: "array: Leads to add"
returns:
  ok: "boolean: True when the add operation succeeds"
---

`instantly.lead.add` exposes the shared Instantly lead add tool inside the `email_campaign` workflow.

Use only after the prospect list is approved.

## Example

```bash
printf '%s\n' '{
  "campaign": "immediate-billing-na-ops-q2",
  "skip_if_in_workspace": true,
  "skip_if_in_campaign": true,
  "leads": [
    {
      "email": "sam@northwind.com",
      "first_name": "Sam",
      "last_name": "Lee",
      "company_name": "Northwind",
      "title": "Operations Manager"
    }
  ]
}' | company/workflows/email_campaign/tools/instantly.lead.add/run
```

Multi-lead import example:

```bash
printf '%s\n' '{
  "campaign": "immediate-billing-na-ops-q2",
  "skip_if_in_workspace": true,
  "skip_if_in_campaign": true,
  "leads": [
    {
      "email": "sam@northwind.com",
      "first_name": "Sam",
      "company_name": "Northwind",
      "title": "Operations Manager"
    },
    {
      "email": "alex@contoso.com",
      "first_name": "Alex",
      "company_name": "Contoso",
      "title": "Head of Operations"
    }
  ]
}' | company/workflows/email_campaign/tools/instantly.lead.add/run
```
