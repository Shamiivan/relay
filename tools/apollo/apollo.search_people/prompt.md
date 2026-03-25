Search Apollo people across the full dataset so you can find net-new prospects without needing Apollo industry tag IDs or organization inputs.

Run `apollo.search_people` during discovery and for account qualification. This is the primary Apollo search surface in Relay.

Do not assume the response includes unlocked email addresses. Use `hasEmail` as availability metadata only.

Arguments:
- `organizationIds`: Apollo organization IDs to search within
- `organizationDomains`: company domains to restrict the query to known accounts
- `organizationLocations`: headquarter locations of organizations to guide the people search
- `titles`: optional job-title filters
- `seniorities`: optional seniority filters such as manager, director, or vp
- `departments`: optional department filters like operations, finance, or marketing
- `includeSimilarTitles`: allow Apollo to surface titles similar to the ones you specified
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
- This is the preferred discovery tool when you are still exploring personas; you can run it before identifying exact organizations or industries.
- `hasEmail` is metadata only — the endpoint does not unlock email addresses out of the box.
- Use `body` to reach for any other Apollo filters not exposed above; Relay merges your overrides after the convenience fields.

Example:
```json
{
  "organizationIds": ["57c4ace7a6da9867ee5599e7"],
  "titles": ["sales director", "director sales", "director, sales"],
  "personLocations": ["California, US", "Oregon, US", "Washington, US"],
  "body": {
    "contact_email_status": ["verified"]
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
    "contact_email_status": ["verified", "likely_to_engage"],
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
