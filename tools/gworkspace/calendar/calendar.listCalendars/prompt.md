Use `calendar.listCalendars` to discover the user's visible calendars.

The `id` field in the response is the `calendarId` required by all other calendar tools. The user's main calendar has `primary: true` — use `"primary"` as the calendarId for it.

Use this tool first when the user refers to a calendar by name, then pass the matching `id` to subsequent tools.
