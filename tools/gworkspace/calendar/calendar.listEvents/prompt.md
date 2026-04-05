Use `calendar.listEvents` to browse upcoming events or search by keyword.

Always set `timeMin` to the current time when listing upcoming events — otherwise the API returns past events too.

Common patterns:
- Upcoming today: `timeMin` = now, `timeMax` = end of day
- This week: `timeMin` = now, `timeMax` = end of week
- Search: set `query` to match event title, description, or location

Use `singleEvents: true` (default) to expand recurring events into individual instances. This is required for `orderBy: "startTime"` to work.

The `id` field in each event is used by `calendar.getEvent`, `calendar.patchEvent`, and `calendar.deleteEvent`.
