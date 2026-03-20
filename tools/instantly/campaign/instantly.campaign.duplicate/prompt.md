# Instantly Campaign Duplicate

Use this tool to duplicate an existing Instantly campaign.

Use it when:
- you want the same configuration as an existing campaign
- you need a quick copy with an optional new name

Arguments:
- `campaignId` string UUID, required
- `name` string, optional: custom name for the duplicated campaign

Returns:
- `campaign`: normalized campaign object for the newly duplicated campaign

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548"}
```

```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548","name":"Q2 Outbound Copy"}
```

Typical use cases:
- clone a working campaign into a new draft
- create an A/B variant from an existing setup
- preserve schedule and sending settings while changing naming or leads later

This writes state.
