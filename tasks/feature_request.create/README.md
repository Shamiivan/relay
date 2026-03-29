---
intent: feature_request.create
description: Create a feature request markdown file under AGENTS/feature_requests from structured fields.
fields:
  title: "string: Human-readable feature request title"
  problem: "string: What is missing, broken, or painful today"
  context: "string: Optional surrounding context, constraints, or examples"
  proposed_change: "string: The requested product or engineering change"
  acceptance_criteria: "string[]: Observable completion conditions"
  possible_tests: "string[]: Optional verification ideas"
  date: "string: Optional YYYY-MM-DD override for the filename prefix"
returns:
  path: "string: Relative path to the created feature request markdown file"
  terminal: "object: Terminal workflow hint with status and next-step instruction"
---

`feature_request.create` writes a normalized feature request file to `AGENTS/feature_requests`.

It validates the structured request fields, renders the markdown itself, writes the file, and returns the written path plus a terminal instruction for the next step.

## Example

```bash
printf '%s\n' '{
  "title": "Log model reasoning tokens",
  "problem": "Reasoning-token usage is not visible in run logs.",
  "context": "Operators need to inspect model cost and hidden-token behavior after runs.",
  "proposed_change": "Record reasoning token usage in the run logs and surfaced summaries.",
  "acceptance_criteria": [
    "Run logs include reasoning token counts when the provider exposes them.",
    "Missing reasoning token data does not crash a run."
  ],
  "possible_tests": [
    "Provider response with reasoning token usage writes the values into the log artifact.",
    "Provider response without reasoning token usage still logs successfully."
  ]
}' | tasks/feature_request.create/run
```
