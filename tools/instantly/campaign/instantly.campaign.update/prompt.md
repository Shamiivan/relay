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
- each `campaign_schedule.schedules[]` entry needs its own `timezone`
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

Notes:
- The live Instantly API validates `timezone` on each schedule item, not just at the top of `campaign_schedule`.
- Relay validates Instantly's documented timezone allowlist locally before sending campaign schedule changes.
- Use an Instantly-supported timezone value such as `America/Chicago` for schedule updates.

This writes data.
