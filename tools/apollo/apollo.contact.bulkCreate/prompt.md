Bulk create contacts in Apollo.

Use this only after human approval, because it mutates external system state.

Arguments:
- `body`: native Apollo `contacts/bulk_create` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/contacts/bulk_create`

Notes:
- Prefer `apollo.search_people`, `apollo.person.match`, or `apollo.person.bulkMatch` before this tool so the contact payload is based on resolved people data.
- Do not use this for prospect discovery. Use it only when the user wants contacts written into Apollo.

Example:
```json
{
  "body": {
    "contacts": [
      {
        "first_name": "Mark",
        "last_name": "Twain",
        "email": "mark@example.com",
        "organization_name": "Great American Writers Co.",
        "website_url": "greatamericanwriters.example"
      }
    ]
  }
}
```

Apollo's contact-creation docs show contact writes based on person and company identity fields. This bulk tool passes the native batch payload through under `body`.
