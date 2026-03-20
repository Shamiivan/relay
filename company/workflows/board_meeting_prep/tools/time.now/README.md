---
intent: time.now
description: Get the current date and time.
shared_tool: tools/time
mutates: false
destructive: false
fields: {}
returns:
  iso: "string: ISO 8601 UTC timestamp"
  local: "string: Locale-formatted local time string"
  timestamp: "number: Unix timestamp in milliseconds"
---
`time.now` gets the current date and time.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/time` implementation; inputs and outputs are identical.

## Example

```bash
company/workflows/board_meeting_prep/tools/time.now/run
```
