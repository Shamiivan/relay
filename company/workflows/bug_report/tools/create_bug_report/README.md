---
intent: create_bug_report
description: Create a bug report file under AGENTS/bug_report.
shared_task: tasks/bug_report.create
mutates: true
destructive: false
fields:
  title: "string: Human-readable bug title"
  description: "string: What happened, including error messages if any"
  repro: "string: Minimal steps to reproduce"
  expected: "string: Optional expected behavior"
  version: "string: Optional affected version"
  date: "string: Optional YYYY-MM-DD override for the filename prefix"
returns:
  path: "string: Relative path to the created bug report markdown file"
  terminal: "object: Terminal workflow hint with status and next-step instruction"
---

`create_bug_report` exposes the shared `tasks/bug_report.create` implementation inside the `bug_report` workflow.

After a successful call, the result includes `terminal.status` and `terminal.instruction`. Do not emit plain text or call another tool; call `done_for_now`.
