# Feature Request Contract

Feature requests written under `AGENTS/feature_requests/` should use this normalized shape before rendering:

```json
{
  "title": "string",
  "problem": "string",
  "context": "string",
  "proposed_change": "string",
  "acceptance_criteria": ["string"],
  "possible_tests": ["string"]
}
```

Required fields:

- `title`
- `problem`
- `proposed_change`
- `acceptance_criteria`

Optional fields:

- `context`
- `possible_tests`

Rendered markdown should use these sections in order:

1. `# Feature Request: <title>`
2. `## Problem`
3. `## Context` when non-empty
4. `## Proposed Change`
5. `## Acceptance Criteria`
6. `## Possible Tests` when non-empty
