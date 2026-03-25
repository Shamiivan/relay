Bulk create accounts in Apollo.

Use this only after human approval, because it mutates external system state.

Arguments:
- `body`: native Apollo `accounts/bulk_create` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/accounts/bulk_create`

Notes:
- Prefer `apollo.search_people` to discover target contacts and `apollo.organization.enrich` when you need to confirm company data before creating accounts.
- Do not use this for exploratory work. Use it only when the user wants records written into Apollo.

Example:
```json
{
  "body": {
    "accounts": [
      {
        "name": "Apollo",
        "domain": "apollo.io"
      }
    ]
  }
}
```

Apollo's bulk-account-create docs describe batch account creation with deduplication. This tool passes the native batch payload through under `body`.
