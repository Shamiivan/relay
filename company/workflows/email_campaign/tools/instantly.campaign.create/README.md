---
intent: instantly.campaign.create
description: Create a new Instantly campaign.
shared_tool: tools/instantly/campaign/instantly.campaign.create
mutates: true
destructive: true
fields:
  name: "string: Campaign name"
  campaign: "object: Instantly campaign payload"
returns:
  ok: "boolean: True when campaign creation succeeds"
  campaignId: "string: Created campaign id"
---

`instantly.campaign.create` exposes the shared Instantly campaign creation tool inside the `email_campaign` workflow.

Use only after the draft copy and settings are approved.

## Example

```bash
printf '%s\n' '{
  "name": "Immediate Billing - Ops Managers - NA",
  "campaign_schedule": {
    "timezone": "America/Toronto",
    "schedules": [
      {
        "name": "Weekdays",
        "timing": { "from": "09:00", "to": "17:00" },
        "days": { "1": true, "2": true, "3": true, "4": true, "5": true }
      }
    ]
  },
  "email_list": ["ops@billing-workflows.co"],
  "daily_limit": 30,
  "stop_on_reply": true,
  "text_only": true,
  "first_email_text_only": true,
  "open_tracking": false,
  "link_tracking": false
}' | company/workflows/email_campaign/tools/instantly.campaign.create/run
```

Multi-sender example:

```bash
printf '%s\n' '{
  "name": "Immediate Billing - Founder Led",
  "campaign_schedule": {
    "timezone": "America/New_York",
    "schedules": [
      {
        "name": "Morning Window",
        "timing": { "from": "08:30", "to": "11:30" },
        "days": { "1": true, "2": true, "3": true, "4": true, "5": true }
      }
    ]
  },
  "email_list": ["founder@billing-workflows.co", "ops@billing-workflows.co"],
  "daily_limit": 40,
  "daily_max_leads": 20,
  "stop_on_reply": true,
  "stop_on_auto_reply": true
}' | company/workflows/email_campaign/tools/instantly.campaign.create/run
```
