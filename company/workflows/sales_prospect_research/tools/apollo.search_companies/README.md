---
intent: apollo.search_companies
description: Search Apollo companies with ICP filters and return normalized organization records.
shared_tool: tools/apollo/apollo.search_companies
prompt_ref: tools/apollo/apollo.search_companies/prompt.md
mutates: false
destructive: false
fields:
  page: "number: 1-based page number (default 1)"
  perPage: "number: Results per page, from 1 to 100 (default 25)"
  keywords: "string: Free-text Apollo company search keywords"
  industries: "string[]: Industry keywords to include in company matching"
  industryTagIds: "string[]: Apollo industry tag IDs for exact filtering"
  locations: "string[]: Company HQ locations"
  employeeCountMin: "number: Minimum employee count"
  employeeCountMax: "number: Maximum employee count"
  organizationDomains: "string[]: Exact company domains to constrain search"
returns:
  companies: "Organization[]: Normalized organization records"
  totalCount: "number: Total matching records across all pages"
  hasMore: "boolean: True when another page exists"
---
`apollo.search_companies` searches Apollo companies with ICP filters and returns normalized organization records.

Use this before `apollo.search_people` when you still need to discover the target accounts.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/apollo/apollo.search_companies` implementation; inputs and outputs are identical.

See `tools/apollo/apollo.search_companies/prompt.md` for deeper examples and operating guidance.

## Example

```bash
printf '{"keywords":"developer tools","locations":["Toronto, Canada"],"employeeCountMin":11,"employeeCountMax":200}' | company/workflows/sales_prospect_research/tools/apollo.search_companies/run
```
