Use `calendar.shareCalendar` to grant another user access to a calendar.

Roles:
- `freeBusyReader` — can only see free/busy status
- `reader` — can see all event details
- `writer` — can create and edit events
- `owner` — full control including sharing

Use `calendar.listCalendars` first to get the `calendarId`. The user's primary calendar ID is their email address.
