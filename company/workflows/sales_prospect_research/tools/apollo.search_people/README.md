---
intent: apollo.search_people
description: Search Apollo people within a known organization scope and return normalized prospect records.
shared_tool: tools/apollo/apollo.search_people
prompt_ref: tools/apollo/apollo.search_people/prompt.md
mutates: false
destructive: false
fields:
  organizationIds: "string[]: Apollo organization IDs to scope the search"
  titles: "string[]: Optional job titles to filter on"
  personLocations: "string[]: Optional person-level locations"
  keywords: "string: Optional free-text Apollo people search keywords"
  page: "number: 1-based page number (default 1)"
  perPage: "number: Results per page, from 1 to 100 (default 25)"
returns:
  people: "Person[]: Normalized prospect records"
  totalCount: "number: Total matching records across all pages"
  hasMore: "boolean: True when another page exists"
---
`apollo.search_people` searches Apollo people within a known organization scope and returns normalized prospect records.

Use `apollo.search_companies` first when you do not yet know which companies to target.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.search_people` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.search_people/prompt.md` for deeper examples and operating guidance.

## Example

```bash
printf '{"organizationIds":["org-1","org-2"],"titles":["VP Sales","Head of Growth"]}' | company/workflows/sales_prospect_research/tools/apollo.search_people/run
```
