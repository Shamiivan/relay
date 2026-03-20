Match one person in Apollo using native matching fields such as name, company, domain, or profile URL.

Use this when you already know roughly who the person is and need Apollo to resolve the record.

Arguments:
- `body`: native Apollo `people/match` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/people/match`

Notes:
- This is useful after manual research or when another system already produced candidate person data.
- For bulk resolution, use `apollo.person.bulkMatch`.

Example:
```json
{
  "body": {
    "email": "joshua.garrison@apollo.io",
    "reveal_personal_emails": false,
    "reveal_phone_number": false
  }
}
```

Apollo's enrichment docs show person matching by email, and also by `first_name`, `last_name`, and `domain` when email is not available.
