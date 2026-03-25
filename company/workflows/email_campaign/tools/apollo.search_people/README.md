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

Use it for both net-new discovery and for finding personas once a set of accounts is locked in. Unlike the company search wrapper, the people search can be run without knowing any Apollo IDs — you can target job titles, person locations, seniority, departments, and even organization headquarter filters directly. When you already know some Apollo organizations, include `organizationIds` or `organizationDomains` to tighten the scope.

## Example: net-new discovery (matches Apollo's People API tutorial)

```bash
printf '%s\n' '{
  "titles": ["sales director", "director sales", "director, sales"],
  "personLocations": ["California, US", "Oregon, US", "Washington, US"],
  "perPage": 5
}' | company/workflows/email_campaign/tools/apollo.search_people/run
```

This mirrors Apollo’s documented West Coast sales director search but routed through the normalized `apollo.search_people` contract.

## Example: known accounts + persona tuning

```bash
printf '%s\n' '{
  "organizationIds": ["57c4ace7a6da9867ee5599e7"],
  "titles": ["operations manager"],
  "organizationLocations": ["North America"],
  "personLocations": ["North America"],
  "perPage": 10
}' | company/workflows/email_campaign/tools/apollo.search_people/run
```

## Example: expand seniority, department, and similarity rules

```bash
printf '%s\n' '{
  "titles": ["operations manager"],
  "seniorities": ["manager", "director"],
  "departments": ["operations", "finance"],
  "includeSimilarTitles": true,
  "perPage": 10
}' | company/workflows/email_campaign/tools/apollo.search_people/run
```
