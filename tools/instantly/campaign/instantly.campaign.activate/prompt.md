# Instantly Campaign Activate

Use this tool to activate or resume an existing Instantly campaign.

Use it when:
- a campaign is paused or draft and should start sending
- you need a state-changing operation, not a read

Arguments:
- `campaignId` string UUID, required: the Instantly campaign ID

Returns:
- `campaign`: normalized campaign object
- `campaign.id` string
- `campaign.name` string
- `campaign.status` number or `null`
- `campaign.timestampCreated` optional string
- `campaign.timestampUpdated` optional string

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548"}
```

Typical use cases:
- resume a paused outreach campaign
- activate a newly configured draft campaign

This writes state.
