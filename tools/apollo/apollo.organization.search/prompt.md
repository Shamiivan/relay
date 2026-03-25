Search Apollo organizations using the native organizations search endpoint.

Use this when you need direct organization search fields that are not covered by `apollo.search_people` or `apollo.organization.enrich`.

Arguments:
- `body`: native Apollo `organizations/search` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/organizations/search`

Notes:
- Prefer `apollo.search_people` for lead discovery in Relay.
- Use this tool when you need Apollo-specific organization search fields that the people wrapper does not expose.

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
