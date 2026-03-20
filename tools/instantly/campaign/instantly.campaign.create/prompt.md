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

Typical use cases:
- create a new outbound campaign
- create a draft campaign before adding leads
- create a campaign with specific sending controls

This writes data.
