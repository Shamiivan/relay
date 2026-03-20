Bulk match multiple people in Apollo using native matching fields.

Use this when you already have a prospect list from another source and need Apollo resolution in one batch.

Arguments:
- `body`: native Apollo `people/bulk_match` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/people/bulk_match`

Notes:
- Use this when you have many person candidates and need Apollo IDs or enriched matches back.
- For one person, prefer `apollo.person.match`.

Example:
```json
{
  "body": {
    "details": [
      { "id": "64a7ff0cc4dfae00013df1a5" },
      { "email": "joshua.garrison@apollo.io" }
    ]
  }
}
```

Apollo's bulk people enrichment docs describe sending person objects in the `details` array, with up to 10 people per request.
