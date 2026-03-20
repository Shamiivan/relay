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

```json
{"campaignId":"efccfc78-5cc8-45cf-82cd-c3671fc51d3a","variables":["caseStudy","competitor","roleFocus"]}
```

Typical use cases:
- add merge tags before importing leads
- standardize variables needed by sequence copy
- prepare campaign templates for more personalized copy

This writes state.
