Use `calendar.createEvent` to create a new event on a Google Calendar.

Key rules:
- Use `dateTime` (RFC3339) for timed events, `date` (YYYY-MM-DD) for all-day events. Never mix them.
- Always include `timeZone` when the user specifies a location or timezone.
- `sendUpdates: "all"` (default) sends invitation emails to attendees.
- For recurring events, pass RRULE strings in `recurrence`, e.g. `["RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10"]`.

Examples:
- Timed event: `start: { dateTime: "2026-04-07T14:00:00-04:00" }, end: { dateTime: "2026-04-07T15:00:00-04:00" }`
- All-day event: `start: { date: "2026-04-07" }, end: { date: "2026-04-08" }` (end date is exclusive)
- With attendees: `attendees: [{ email: "alice@example.com" }, { email: "bob@example.com", optional: true }]`
