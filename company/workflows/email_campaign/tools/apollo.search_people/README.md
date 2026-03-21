---
intent: apollo.search_people
description: Search Apollo for people at target companies.
shared_tool: tools/apollo/apollo.search_people
mutates: false
destructive: false
fields:
  query: "object: Apollo people search filters"
returns:
  ok: "boolean: True when the search succeeds"
  people: "array: Matching people"
---

`apollo.search_people` exposes the shared Apollo people search tool inside the `email_campaign` workflow.

Use it only after the ICP and targeting are approved.

## Example

```bash
printf '%s\n' '{
  "organizationIds": ["57c4ace7a6da9867ee5599e7"],
  "titles": ["operations manager", "head of operations"],
  "personLocations": ["North America"],
  "perPage": 10
}' | company/workflows/email_campaign/tools/apollo.search_people/run
```

Verified email example:

```bash
printf '%s\n' '{
  "organizationIds": ["57c4ace7a6da9867ee5599e7"],
  "titles": ["operations manager"],
  "body": {
    "contact_email_status_v2": ["verified"]
  },
  "perPage": 10
}' | company/workflows/email_campaign/tools/apollo.search_people/run
```

Seniority and department tuning example:

```bash
printf '%s\n' '{
  "organizationIds": ["org_1", "org_2", "org_3"],
  "body": {
    "person_seniorities": ["manager", "director", "vp"],
    "person_departments": ["operations", "finance"],
    "include_similar_titles": true
  },
  "perPage": 25
}' | company/workflows/email_campaign/tools/apollo.search_people/run
```
