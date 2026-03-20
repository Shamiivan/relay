Fetch a single Apollo organization record by Apollo-native lookup arguments.

Use this for detailed account reads after search or enrichment.

Arguments:
- `id`: convenience alias for one Apollo organization ID
- `body`: native Apollo `organizations/show` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/organizations/show`

Notes:
- If `id` alone does not work for a specific lookup, pass the exact Apollo-native show payload in `body`.
- Use this when you need a full company record rather than normalized search output.

Example:
```json
{
  "id": "57c4ace7a6da9867ee5599e7"
}
```

Apollo's complete organization info docs use a path-style organization ID lookup. If the wrapper needs a different native payload for your account, pass that under `body`.
