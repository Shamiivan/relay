# Instantly Campaign Search

Use this tool to search and list Instantly campaigns.

Use it when:
- you need campaign IDs before reading or updating a specific campaign
- you want structured Instantly data instead of generic web results

Arguments:
- `limit` integer 1-100, default `10`
- `startingAfter` string cursor, optional
- `search` string, optional: campaign name search
- `tagIds` string array, optional: filter by Instantly tag IDs
- `aiSdrId` UUID, optional
- `status` optional integer enum: `-99`, `-2`, `-1`, `0`, `1`, `2`, `3`, `4`

Returns:
- `campaigns`: array of normalized campaign objects
- `nextStartingAfter`: optional cursor for pagination

Examples:
```json
{"limit":5}
```

```json
{"search":"First Ever Campaign","limit":1}
```

```json
{"status":2,"limit":10}
```

```json
{"tagIds":["tag-1","tag-2"],"limit":25}
```

Typical use cases:
- find a campaign ID by name
- list paused campaigns
- paginate through campaigns in a large workspace
- filter campaigns tied to a specific AI SDR
