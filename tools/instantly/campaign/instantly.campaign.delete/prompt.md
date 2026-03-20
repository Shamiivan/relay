# Instantly Campaign Delete

Use this tool to permanently delete an Instantly campaign.

Use it when:
- the campaign should be removed
- a destructive delete is explicitly intended

Arguments:
- `campaignId` string UUID, required

Returns:
- `deleted` always `true` on success
- `campaignId` string UUID

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548"}
```

```json
{"campaignId":"efccfc78-5cc8-45cf-82cd-c3671fc51d3a"}
```

Typical use cases:
- remove a bad test campaign
- clean up duplicate or obsolete campaigns
- delete a campaign created from a failed import

This writes state and is destructive.
