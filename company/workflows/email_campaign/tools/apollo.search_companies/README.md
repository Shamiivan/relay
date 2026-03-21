---
intent: apollo.search_companies
description: Search Apollo for companies that match an ICP.
shared_tool: tools/apollo/apollo.search_companies
mutates: false
destructive: false
fields:
  query: "object: Apollo company search filters"
returns:
  ok: "boolean: True when the search succeeds"
  organizations: "array: Matching organizations"
---

`apollo.search_companies` exposes the shared Apollo company search tool inside the `email_campaign` workflow.

Use it after the offer and ICP are approved, not during early discovery.

## Example

```bash
printf '%s\n' '{
  "industries": ["marketing and advertising", "management consulting"],
  "locations": ["North America"],
  "employeeCountMin": 5,
  "employeeCountMax": 50,
  "perPage": 10
}' | company/workflows/email_campaign/tools/apollo.search_companies/run
```

Exact Apollo industry tag example:

```bash
printf '%s\n' '{
  "industryTagIds": ["5567cd4773696439b10b0000"],
  "employeeCountMin": 11,
  "employeeCountMax": 200,
  "perPage": 10
}' | company/workflows/email_campaign/tools/apollo.search_companies/run
```

Advanced native Apollo filter example:

```bash
printf '%s\n' '{
  "keywords": "billing automation",
  "locations": ["United States"],
  "body": {
    "sort_by_field": "employee_count",
    "sort_ascending": true,
    "organization_num_jobs_range": { "min": 1 }
  },
  "perPage": 10
}' | company/workflows/email_campaign/tools/apollo.search_companies/run
```
