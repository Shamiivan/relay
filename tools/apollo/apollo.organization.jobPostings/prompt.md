Fetch Apollo job posting data for one or more organizations.

Use this when hiring activity is part of account research or qualification.

Arguments:
- `organizationId`: convenience alias for one Apollo organization ID
- `organizationIds`: convenience alias for multiple Apollo organization IDs
- `body`: additional native Apollo `organizations/job_postings` request fields

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/organizations/job_postings`

Notes:
- This tool returns the raw Apollo response because hiring-signal payloads can be broad and endpoint-specific.

Example:
```json
{
  "organizationId": "57c4ace7a6da9867ee5599e7",
  "body": {
    "page": 1,
    "per_page": 10
  }
}
```

Apollo's job postings docs describe an organization-specific job-postings lookup with pagination.
