---
intent: bug_report
description: Create a normalized bug report file under AGENTS/bug_report from a user report.
fields: {}
---

Use `bug_report` when the user wants to report something broken.

Default behavior:

- write the bug report under `AGENTS/bug_report`
- default to creating a new bug report
- do not ask whether to create a new bug report unless the user explicitly asks you to search, deduplicate, or check for an existing report first
- if the user explicitly asks to see or inspect existing bugs, run `list_bug_reports`
- do not ask where to put it unless the user explicitly asks for a different destination
- before creating the bug report, ask 2 or 3 short clarifying questions with `ask_human` unless the user explicitly says to just do it or the report is already fully specified
- use the clarifying questions to tighten `description`, `repro`, and `expected`
- generate `version` yourself only when it is obvious from the conversation; otherwise leave it empty unless the user provides it
- if the user explicitly says to drop, cancel, or stop, run `cancel` and then call `done_for_now`

Execution:

1. If the report is not already fully specified, ask 2 or 3 concise clarifying questions in one `ask_human` call.
   Focus on:
   - what happened
   - minimal reproduction steps
   - what should have happened instead
2. Convert the user report plus answers into these fields:
   - `title`
   - `description`
   - `repro`
   - `expected`
   - `version`
3. Run the workflow tool:

```bash
printf '%s\n' '{
  "title": "Model reasoning tokens are not logged",
  "description": "The logs never include model reasoning-token usage, even when the provider exposes it.",
  "repro": "1. Run a model that reports reasoning-token usage.\n2. Inspect the generated logs.\n3. Observe that no reasoning-token field is present.",
  "expected": "Logs should include reasoning-token usage when the provider returns it.",
  "version": "0.49.0"
}' | company/workflows/bug_report/tools/create_bug_report/run
```

4. After the tool succeeds, its result will include `terminal.status` and `terminal.instruction`. The next and only valid action is `done_for_now`.

Cancellation:

```bash
printf '{"reason":"User asked to drop the task."}' | company/workflows/bug_report/tools/cancel/run
```

After `cancel` succeeds, its result will include `terminal.status` and `terminal.instruction`. The next and only valid action is `done_for_now`.

Inspection:

```bash
printf '{}' | company/workflows/bug_report/tools/list_bug_reports/run
```

Rules:

- prefer concrete, implementation-ready wording
- keep reproduction steps minimal and specific
- ask at most 3 clarifying questions before creation
- keep clarification questions short and specific
- do not ask whether a new bug report should be created by default
- use `list_bug_reports` only when the user explicitly asks to inspect existing bugs
- do not output plain text directly; use the tool result, then `done_for_now`
