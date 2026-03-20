---
intent: apollo.search_companies
description: Search Apollo companies with ICP filters
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
---
Search Apollo organizations that match an ICP.

Use this before `apollo.search_people` when you still need to discover the target accounts.

## Examples

```bash
printf '{"keywords":"developer tools","locations":["Toronto, Canada"],"employeeCountMin":11,"employeeCountMax":200}' | workflows/sales_prospect_research/tools/apollo.search_companies/run
printf '{"industryTagIds":["5567cd4773696439b10b0000"],"perPage":10}' | workflows/sales_prospect_research/tools/apollo.search_companies/run
```
