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

Returns:
- `companies`: normalized company records with `id`, `name`, `domain`, `industry`, and `estimatedEmployeeCount`
- `totalCount`: total result count reported by Apollo
- `hasMore`: whether additional pages are available

Notes:
- This is the preferred org-search tool for sales-agency prospecting.
- It normalizes Apollo's response so the agent can reason over account lists without reading raw payloads.

Example:
```json
{
  "keywords": "developer tools",
  "locations": ["San Francisco, US"],
  "employeeCountMin": 11,
  "employeeCountMax": 200,
  "perPage": 5
}
```

This corresponds to Apollo's organization search examples that use `q_keywords`, company-location filters, and pagination on `mixed_companies/search`.
