---
intent: create_feature_request
description: Create a feature request file under AGENTS/feature_requests.
shared_task: tasks/feature_request.create
mutates: true
destructive: false
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

`create_feature_request` exposes the shared `tasks/feature_request.create` implementation inside the `feature_request` workflow.

Use it when the user wants to capture a specific feature request under `AGENTS/feature_requests`.

After a successful call, the result includes `terminal.status` and `terminal.instruction`. Do not emit plain text or call another tool; call `done_for_now`.

## Example

```bash
printf '%s\n' '{
  "title": "Log model reasoning tokens",
  "problem": "Reasoning token usage is not visible in run logs.",
  "context": "Operators need to inspect hidden-token usage and provider cost behavior after runs.",
  "proposed_change": "Write reasoning token usage to run logs and surfaced summaries when providers expose it.",
  "acceptance_criteria": [
    "Run logs include reasoning token counts when providers expose them.",
    "Runs do not fail when a provider omits reasoning token data."
  ],
  "possible_tests": [
    "Mock a provider response with reasoning token usage and verify it is written to the log artifact.",
    "Mock a provider response without reasoning token usage and verify the run still completes."
  ]
}' | company/workflows/feature_request/tools/create_feature_request/run
```
