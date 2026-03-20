Fetch the top people Apollo associates with one or more organizations.

Use this after account selection when you want likely senior contacts without running a broader people search.

Arguments:
- `organizationId`: convenience alias for one Apollo organization ID
- `organizationIds`: convenience alias for multiple Apollo organization IDs
- `body`: additional native Apollo `mixed_people/organization_top_people` request fields

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/mixed_people/organization_top_people`

Notes:
- Prefer this when you already know the target accounts and want Apollo's top-contact view.
- For broader or more filterable person discovery, use `apollo.search_people`.

Example:
```json
{
  "organizationIds": ["57c4ace7a6da9867ee5599e7"],
  "body": {
    "per_page": 5
  }
}
```

Apollo exposes this as an organization-top-people endpoint. Relay lets you pass the known organization IDs directly and any remaining native fields under `body`.
