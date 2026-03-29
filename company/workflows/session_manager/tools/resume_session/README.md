---
intent: resume_session
description: Load the full thread history for a specific paused session.
shared_tool: tools/session/resume_session
mutates: false
destructive: false
fields:
  id: "string (required): Session id to load. Get ids from list_sessions."
returns:
  xml: "<session> element with metadata and full <thread> history"
---

`resume_session` loads the complete thread history of a paused session so you can continue the work.

Call `list_sessions` first to discover available session ids.

## Example

```bash
printf '{"id":"hey-there-i-need-you__unknown__2026-03-29T03-38-16.140Z"}' | company/workflows/session_manager/tools/resume_session/run
```

Output:
```xml
<session id="hey-there-i-need-you__unknown__2026-03-29T03-38-16.140Z">
  <workflow>unknown</workflow>
  <created_at>2026-03-29T03:38:16.140Z</created_at>
  <awaiting>completion_confirmation</awaiting>
  <proposed_final>Okay, I've remembered the number 1969.</proposed_final>
  <thread>
    <system_note>
    ...
    </system_note>
    <user_message>
    ...
    </user_message>
  </thread>
</session>
```
