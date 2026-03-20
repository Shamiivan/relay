Search Apollo organizations using the native organizations search endpoint.

Use this when you need the direct Apollo organization search response rather than Relay's normalized `apollo.search_companies` output.

Arguments:
- `body`: native Apollo `organizations/search` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/organizations/search`

Notes:
- Prefer `apollo.search_companies` for normal sales-agency prospecting because it returns normalized companies plus `totalCount` and `hasMore`.
- Use this tool when you need Apollo-specific search fields that the normalized wrapper does not expose.

Example:
```json
{
  "body": {
    "q_keywords": "developer tools",
    "per_page": 5
  }
}
```

This mirrors Apollo's organization search examples that send `q_keywords` and `per_page` to the native search endpoint.
