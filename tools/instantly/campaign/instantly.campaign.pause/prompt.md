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

```json
{"campaignId":"efccfc78-5cc8-45cf-82cd-c3671fc51d3a"}
```

Typical use cases:
- pause a live campaign during review
- stop a campaign with bad messaging or wrong targeting
- halt sending while accounts or copy are being updated

This writes state.
