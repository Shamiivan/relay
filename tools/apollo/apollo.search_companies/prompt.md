Search Apollo companies that match an ICP or account list filter.

Use this before `apollo.search_people` when you need target organizations first.

Prefer explicit filters over broad keyword-only queries. If the result set is large, summarize `totalCount` and ask the user to narrow the ICP before continuing.

Arguments:
- `page`: 1-based result page
- `perPage`: number of companies to return
- `keywords`: free-text company search string
- `industries`: industry keywords folded into search
- `industryTagIds`: Apollo industry tag IDs for precise filtering
- `locations`: company headquarter locations
- `employeeCountMin`: minimum employee count
- `employeeCountMax`: maximum employee count
- `organizationDomains`: exact company domain filters
- `body`: additional native Apollo search fields for advanced tuning

Returns:
- `companies`: normalized company records with `id`, `name`, `domain`, `industry`, and `estimatedEmployeeCount`
- `totalCount`: total result count reported by Apollo
- `hasMore`: whether additional pages are available

Notes:
- This is the preferred org-search tool for sales-agency prospecting.
- It normalizes Apollo's response so the agent can reason over account lists without reading raw payloads.
- For advanced tuning, pass native Apollo fields under `body`. Relay will merge your `body` with the convenience filters above.

Example:
```json
{
  "keywords": "developer tools",
  "locations": ["San Francisco, US"],
  "employeeCountMin": 11,
  "employeeCountMax": 200,
  "body": {
    "sort_by_field": "employee_count"
  },
  "perPage": 5
}
```

This corresponds to Apollo's organization search examples that use `q_keywords`, company-location filters, and pagination on `mixed_companies/search`.

Example: narrow by exact Apollo industry tags
```json
{
  "industryTagIds": ["5567cd4773696439b10b0000"],
  "employeeCountMin": 51,
  "employeeCountMax": 500,
  "perPage": 10
}
```

Example: use advanced native Apollo tuning under `body`
```json
{
  "keywords": "cybersecurity",
  "body": {
    "currently_using_any_of_technology_uids": ["salesforce", "hubspot"],
    "organization_num_jobs_range": {
      "min": 1
    },
    "sort_by_field": "employee_count",
    "sort_ascending": false
  },
  "perPage": 10
}
```

Example: prospect into a known account set by domain
```json
{
  "organizationDomains": ["stripe.com", "ramp.com", "mercury.com"],
  "perPage": 25
}
```
