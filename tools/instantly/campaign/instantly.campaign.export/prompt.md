# Instantly Campaign Export

Use this tool to fetch the exported JSON representation of a campaign and return the normalized campaign summary.

Use it when:
- you need a safe read against the export endpoint
- you want to verify a campaign exists before sharing or cloning workflows

Arguments:
- `campaignId` string UUID, required

Returns:
- `campaign`: normalized campaign object

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548"}
```

Typical use cases:
- smoke-test export access
- read a campaign through the export path before using another workflow
- confirm a campaign ID is valid
