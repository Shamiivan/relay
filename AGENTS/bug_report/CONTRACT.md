# Bug Report Contract

Bug reports written under `AGENTS/bug_report/` should use this normalized shape before rendering:

```json
{
  "title": "string",
  "description": "string",
  "repro": "string",
  "expected": "string",
  "version": "string"
}
```

Required fields:

- `title`
- `description`
- `repro`

Optional fields:

- `expected`
- `version`

Rendered markdown should use these sections in order:

1. `# Bug Report: <title>`
2. `## What happened?`
3. `## Steps to reproduce`
4. `## Expected behavior` when non-empty
5. `## Version` when non-empty
