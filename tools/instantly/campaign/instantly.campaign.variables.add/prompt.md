# Instantly Campaign Variables Add

Use this tool to register custom variable names on a campaign.

Use it when:
- templates or sequences need additional variable placeholders
- a campaign should support more merge variables before leads are added

Arguments:
- `campaignId` string UUID, required
- `variables` string array, required, at least one item

Returns:
- `campaign`: normalized campaign object

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548","variables":["firstName"]}
```

```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548","variables":["firstName","companyName","painPoint"]}
```

Typical use cases:
- add merge tags before importing leads
- standardize variables needed by sequence copy

This writes state.
