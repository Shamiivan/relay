Search Apollo people within specific organizations.

Run `apollo.search_companies` first when you are still building the target account list. This tool is meant for prospect selection after the organization scope is known.

Do not assume the response includes unlocked email addresses. Use `hasEmail` as availability metadata only.

Arguments:
- `organizationIds`: Apollo organization IDs to search within
- `titles`: optional job-title filters
- `personLocations`: optional person-level locations
- `keywords`: optional free-text people search string
- `page`: 1-based result page
- `perPage`: number of people to return
- `body`: additional native Apollo search fields for advanced tuning

Returns:
- `people`: normalized person records with `id`, `firstName`, `lastName`, `title`, `organizationId`, `organizationName`, and `hasEmail`
- `totalCount`: total result count reported by Apollo
- `hasMore`: whether additional pages are available

Notes:
- This is the preferred person-search tool after target accounts are known.
- It does not guarantee unlocked email addresses; `hasEmail` only tells you whether Apollo says email is available.
- For advanced tuning, pass native Apollo fields under `body`. Relay will merge your `body` with the convenience filters above.

Example:
```json
{
  "organizationIds": ["57c4ace7a6da9867ee5599e7"],
  "titles": ["sales director", "director sales", "director, sales"],
  "personLocations": ["California, US", "Oregon, US", "Washington, US"],
  "body": {
    "contact_email_status_v2": ["verified"]
  },
  "perPage": 5
}
```

This follows Apollo's documented People API Search example for west-coast sales directors, adapted to Relay's JSON input shape.

Example: tune for senior outbound personas
```json
{
  "organizationIds": ["57c4ace7a6da9867ee5599e7"],
  "body": {
    "person_seniorities": ["director", "vp", "c_suite"],
    "person_departments": ["sales"],
    "include_similar_titles": true
  },
  "perPage": 10
}
```

Example: prioritize deliverable work emails
```json
{
  "organizationIds": ["57c4ace7a6da9867ee5599e7"],
  "titles": ["head of growth", "vp marketing"],
  "body": {
    "contact_email_status_v2": ["verified", "likely_to_engage"],
    "person_locations": ["New York, US", "California, US"]
  },
  "perPage": 10
}
```

Example: search broadly across many target accounts with native filters
```json
{
  "organizationIds": ["org_1", "org_2", "org_3"],
  "body": {
    "q_keywords": "revenue operations",
    "person_titles": ["revops", "revenue operations"],
    "page": 2,
    "per_page": 25
  }
}
```
