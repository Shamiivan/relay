Bulk enrich multiple organizations in Apollo using native company identifiers.

Use this when an account list needs company metadata before campaign creation or CRM sync.

Arguments:
- `body`: native Apollo `organizations/bulk_enrich` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/organizations/bulk_enrich`

Notes:
- Use this when you already have a list of organizations and need richer account detail in batch.
- For one company, prefer `apollo.organization.enrich`.

Example:
```json
{
  "body": {
    "domains": ["apollo.io", "google.com"]
  }
}
```

Apollo's bulk organization enrichment docs describe enriching up to 10 companies in one request. This tool passes the native batch payload through under `body`.
