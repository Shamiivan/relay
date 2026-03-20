Enrich one organization in Apollo using native company identifiers such as domain, name, or profile URLs.

Use this when search results need richer account detail before outreach.

Arguments:
- `body`: native Apollo `organizations/enrich` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/organizations/enrich`

Notes:
- This is useful after `apollo.search_companies` when you want more company detail than the normalized search output carries.
- Prefer a stable identifier such as company domain when available.

Example:
```json
{
  "body": {
    "domain": "apollo.io"
  }
}
```

Apollo's enrichment docs show company enrichment by stable identifiers such as domain.
