# Instantly Campaign From Export

Use this tool to create a campaign from a shared/exported campaign source.

Use it when:
- a campaign has been shared and should be imported into the workspace
- you want a new campaign based on a shared campaign ID

Arguments:
- `campaignId` string UUID, required: the shared/exported campaign ID

Returns:
- `campaign`: normalized campaign object for the created campaign

Examples:
```json
{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548"}
```

Typical use cases:
- import a shared campaign into a workspace
- recreate a campaign from an exported/shared source

This writes state.
