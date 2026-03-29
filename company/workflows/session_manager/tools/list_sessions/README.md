---
intent: list_sessions
description: List all paused sessions.
shared_tool: tools/session/list_sessions
mutates: false
destructive: false
fields: {}
returns:
  xml: "<sessions> element with one <session> per paused session"
---

`list_sessions` lists all paused sessions so you can pick one to resume.

## Example

```bash
printf '{}' | company/workflows/session_manager/tools/list_sessions/run
```

Output:
```xml
<sessions>
  <session id="hey-there-i-need-you__unknown__2026-03-29T03-38-16.140Z">
    <workflow>unknown</workflow>
    <created_at>2026-03-29T03:38:16.140Z</created_at>
    <awaiting>completion_confirmation</awaiting>
    <proposed_final>Okay, I've remembered the number 1969.</proposed_final>
  </session>
</sessions>
```

Once you have the id, call `resume_session` with it to load the full thread history.
