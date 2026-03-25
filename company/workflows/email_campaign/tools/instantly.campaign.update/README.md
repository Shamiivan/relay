---
intent: instantly.campaign.update
description: Update an existing Instantly campaign.
shared_tool: tools/instantly/campaign/instantly.campaign.update
mutates: true
destructive: false
fields:
  campaignId: "string: Instantly campaign id"
  campaign: "object: Updated Instantly campaign payload"
returns:
  ok: "boolean: True when update succeeds"
---

`instantly.campaign.update` exposes the shared Instantly campaign update tool inside the `email_campaign` workflow.

Use it to revise campaign settings after creation.

## Example

```bash
printf '%s\n' '{
  "campaignId": "019c0e38-c5be-70d5-b730-fdd27bea4548",
  "daily_limit": 30,
  "stop_on_reply": true,
  "open_tracking": false,
  "link_tracking": false
}' | company/workflows/email_campaign/tools/instantly.campaign.update/run
```

Schedule patch example:

```bash
printf '%s\n' '{
  "campaignId": "019c0e38-c5be-70d5-b730-fdd27bea4548",
  "campaign_schedule": {
    "timezone": "America/Chicago",
    "schedules": [
      {
        "name": "West Coast Hours",
        "timezone": "America/Chicago",
        "timing": { "from": "09:00", "to": "15:00" },
        "days": { "1": true, "2": true, "3": true, "4": true, "5": true }
      }
    ]
  }
}' | company/workflows/email_campaign/tools/instantly.campaign.update/run
```

Sender rotation example:

```bash
printf '%s\n' '{
  "campaignId": "efccfc78-5cc8-45cf-82cd-c3671fc51d3a",
  "email_list": ["ops1@billing-workflows.co", "ops2@billing-workflows.co"],
  "daily_limit": 50,
  "stop_on_auto_reply": true
}' | company/workflows/email_campaign/tools/instantly.campaign.update/run
```

Notes:
- The live Instantly API requires `campaign_schedule.schedules[].timezone`.
- A top-level `campaign_schedule.timezone` is not enough by itself.
