# Instantly Campaign Pause

Use this tool to stop or pause an Instantly campaign.

Use it when:
- sending should stop immediately
- a campaign should remain in place but not continue processing

Arguments:
- `campaignId` string UUID, required

Returns:
- `campaign`: normalized campaign object

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548"}
```

Typical use cases:
- pause a live campaign during review
- stop a campaign with bad messaging or wrong targeting

This writes state.
