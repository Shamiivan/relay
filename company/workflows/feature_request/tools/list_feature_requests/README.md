---
intent: list_feature_requests
description: List the current feature request files under AGENTS/feature_requests.
mutates: false
destructive: false
fields: {}
returns:
  count: "number: Number of feature request files returned"
  reports: "array: Feature request file records with name and path"
---

`list_feature_requests` returns the current feature request files under `AGENTS/feature_requests`.

Use it only when the user explicitly asks to see, search, deduplicate, or inspect existing feature requests before creating a new one.

After a successful call, do not create a new feature request unless the user explicitly wants that next.
