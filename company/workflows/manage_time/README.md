---
intent: manage_time
description: Get the current date, time, day of the week, and timezone information.
fields: {}
---

Use `manage_time` when the user asks about the current time, date, day of the week, or timezone.

## time.now

Get the current date and time including the day name (e.g. Monday).

```bash
printf '{}' | company/workflows/manage_time/tools/time.now
```

Returns: `iso`, `local`, `dayName`, `datePretty`, `timestamp`, `timeZone`, `utcOffset`

## Rules

- Use `datePretty` (e.g. "Monday, April 13, 2026") when presenting the date to the user.
- Use `dayName` when the user asks what day it is.
- Use `timeZone` and `utcOffset` when the user needs timezone context.
