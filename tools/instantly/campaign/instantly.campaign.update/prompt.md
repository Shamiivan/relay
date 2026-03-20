# Instantly Campaign Update

Use this tool to patch an existing Instantly campaign.

Use it when:
- only some campaign fields should change
- the campaign already exists and should not be recreated

Arguments:
- `campaignId` string UUID, required
- plus any mutable Instantly campaign fields
- common fields:
- `name`
- `campaign_schedule`
- `sequences`
- `email_list`
- `daily_limit`
- `stop_on_reply`
- `link_tracking`
- `open_tracking`
- `owned_by`
- `ai_sdr_id`

Returns:
- `campaign`: normalized campaign object

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548","name":"Updated Campaign Name"}
```

```json
{
  "campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548",
  "daily_limit":75,
  "stop_on_reply":true,
  "open_tracking":true
}
```

```json
{
  "campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548",
  "campaign_schedule": {
    "timezone": "America/Los_Angeles",
    "schedules": [
      {
        "name": "West Coast Hours",
        "timing": { "from": "09:00", "to": "15:00" },
        "days": { "1": true, "2": true, "3": true, "4": true, "5": true }
      }
    ]
  }
}
```

```json
{
  "campaignId":"efccfc78-5cc8-45cf-82cd-c3671fc51d3a",
  "email_list":["sender1@example.com","sender2@example.com"],
  "daily_limit":100,
  "stop_on_auto_reply":true
}
```

Typical use cases:
- rename a campaign
- change sending limits or tracking settings
- patch scheduling or ownership without rebuilding the campaign
- rotate senders or adjust schedule windows

This writes data.
