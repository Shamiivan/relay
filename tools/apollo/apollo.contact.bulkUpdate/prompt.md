Bulk update contacts in Apollo.

Use this only after human approval, because it mutates external system state.

Arguments:
- `body`: native Apollo `contacts/bulk_update` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/contacts/bulk_update`

Notes:
- Use this when the user already has Apollo contact records and wants to change them in bulk.
- Do not use it to create missing contacts; use `apollo.contact.bulkCreate` for that.

Example:
```json
{
  "body": {
    "contacts": [
      {
        "id": "contact_123",
        "contact_stage_id": "stage_456"
      }
    ]
  }
}
```

Apollo's bulk-update docs describe updating multiple contacts with shared contact attributes such as stages, owners, and custom fields.
