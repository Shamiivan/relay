---
intent: list_bug_reports
description: List the current bug report files under AGENTS/bug_report.
mutates: false
destructive: false
fields: {}
returns:
  count: "number: Number of bug report files returned"
  reports: "array: Bug report file records with name and path"
---

`list_bug_reports` returns the current bug report files under `AGENTS/bug_report`.

Use it only when the user explicitly asks to see, search, deduplicate, or inspect existing bug reports before creating a new one.

After a successful call, do not create a new bug report unless the user explicitly wants that next.
