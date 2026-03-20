---
intent: apollo.search_people
description: Search Apollo people within known organizations
fields:
  organizationIds: "string[]: Apollo organization IDs to scope the search"
  titles: "string[]: Optional job titles to filter on"
  personLocations: "string[]: Optional person-level locations"
  keywords: "string: Optional free-text Apollo people search keywords"
  page: "number: 1-based page number (default 1)"
  perPage: "number: Results per page, from 1 to 100 (default 25)"
---
Search Apollo people inside a known set of organizations.

Use `apollo.search_companies` first when you do not yet know which companies to target.

## Examples

```bash
printf '{"organizationIds":["org-1","org-2"],"titles":["VP Sales","Head of Growth"]}' | workflows/sales_prospect_research/tools/apollo.search_people/run
printf '{"organizationIds":["org-1"],"personLocations":["California, US"],"perPage":10}' | workflows/sales_prospect_research/tools/apollo.search_people/run
```
