# Instantly Campaign Get

Use this tool to fetch one Instantly campaign by ID.

Use it when:
- you already know the campaign ID
- you need campaign metadata, not a search list

Arguments:
- `campaignId` string UUID, required

Returns:
- `campaign`: normalized campaign object

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548"}
```

Typical use cases:
- inspect one campaign after search
- confirm a campaign exists before updating or pausing it
