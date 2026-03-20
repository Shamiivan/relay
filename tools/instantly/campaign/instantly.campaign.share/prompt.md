# Instantly Campaign Share

Use this tool to share an Instantly campaign.

Use it when:
- a campaign should be made shareable for reuse elsewhere
- you need the share side effect, not just a read

Arguments:
- `campaignId` string UUID, required

Returns:
- `shared` always `true` on success
- `campaignId` string UUID

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548"}
```

```json
{"campaignId":"efccfc78-5cc8-45cf-82cd-c3671fc51d3a"}
```

Typical use cases:
- prepare a campaign for cross-workspace reuse
- create a sharable source before import/from-export flows
- hand off a campaign template between teams or environments

This writes state.
