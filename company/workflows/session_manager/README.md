---
intent: session_manager
description: Inspect and resume paused agent sessions.
fields: {}
---

Use `session_manager` to pick up prior work. Two tools, used in order:

1. `list_sessions` — shows all paused sessions with id, workflow, and what they were waiting on
2. `resume_session` — loads the full thread history for a specific session id

## Standard flow

```bash
# Step 1: discover what's paused
printf '{}' | company/workflows/session_manager/tools/list_sessions/run

# Step 2: load the session you want to continue
printf '{"id":"<id from step 1>"}' | company/workflows/session_manager/tools/resume_session/run
```
