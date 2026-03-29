---
intent: cancel
description: Cancel the current bug report workflow when the user explicitly asks to stop.
mutates: false
destructive: false
fields:
  reason: "string: Short cancellation reason"
returns:
  reason: "string: Echoed cancellation reason"
  terminal: "object: Terminal workflow hint with status and next-step instruction"
---

`cancel` cleanly terminates the `bug_report` workflow when the user explicitly says to stop, cancel, or drop the task.

After a successful call, the result includes `terminal.status` and `terminal.instruction`. Do not emit plain text or call another tool; call `done_for_now`.
