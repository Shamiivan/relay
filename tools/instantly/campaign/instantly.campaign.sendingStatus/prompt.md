# Instantly Campaign Sending Status

Use this tool to inspect why a campaign is or is not sending.

Use it when:
- campaign send behavior looks blocked or slow
- you need Instantly diagnostics instead of campaign metadata

Arguments:
- `campaignId` string UUID, required
- `withAiSummary` boolean, optional: include Instantly AI summary

Returns:
- `diagnostics`: object or `null`
- `summary`: object or `null`
- diagnostics may include fields such as `campaign_id`, `last_updated`, `status`, and `issue_tracking`

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548"}
```

```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548","withAiSummary":true}
```

Typical use cases:
- explain why a campaign is not sending
- inspect operational health before changing schedule or accounts
- pull a human-readable summary for support/debugging
