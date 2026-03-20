# Instantly Campaign Create

Use this tool to create a new Instantly campaign.

Use it when:
- you need to create a campaign from scratch
- the campaign schedule and sending settings are already known

Arguments:
- accepts native Instantly campaign create fields
- required:
- `name` string
- `campaign_schedule` object with at least one schedule entry
- commonly used optional fields:
- `email_list` string array of sender emails
- `sequences` array
- `daily_limit` number or `null`
- `stop_on_reply` boolean or `null`
- `link_tracking` boolean or `null`
- `open_tracking` boolean or `null`
- `owned_by` UUID or `null`
- `ai_sdr_id` UUID or `null`

Returns:
- `campaign`: normalized campaign object
- `campaign.id` string
- `campaign.name` string
- `campaign.status` number or `null`
- `campaign.timestampCreated` optional string
- `campaign.timestampUpdated` optional string

Examples:
```json
{
  "name": "Q2 Outbound",
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
  "email_list": ["sender@example.com"],
  "daily_limit": 50,
  "stop_on_reply": true
}
```

```json
{
  "name": "Founder Led Outreach",
  "campaign_schedule": {
    "schedules": [
      {
        "name": "Morning Window",
        "timing": { "from": "08:30", "to": "11:30" },
        "days": { "1": true, "2": true, "3": true, "4": true, "5": true }
      }
    ]
  },
  "email_list": ["founder@example.com"],
  "text_only": true,
  "first_email_text_only": true,
  "daily_limit": 25,
  "open_tracking": false,
  "link_tracking": false
}
```

```json
{
  "name": "Enterprise SDR Motion",
  "campaign_schedule": {
    "timezone": "America/New_York",
    "schedules": [
      {
        "name": "Business Hours",
        "timing": { "from": "10:00", "to": "16:00" },
        "days": { "1": true, "2": true, "3": true, "4": true, "5": true }
      }
    ]
  },
  "email_list": ["sdr1@example.com", "sdr2@example.com"],
  "daily_limit": 120,
  "stop_on_reply": true,
  "stop_on_auto_reply": true,
  "daily_max_leads": 40
}
```

Typical use cases:
- create a new outbound campaign
- create a draft campaign before adding leads
- create a campaign with specific sending controls
- create a text-only founder campaign
- create a multi-sender SDR campaign

This writes data.
