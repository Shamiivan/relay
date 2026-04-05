Use `calendar.freebusy` to check when people or calendars are available.

Pass one or more calendar IDs in `items` to see their busy times within the given range. Use `"primary"` for the authenticated user's calendar, or an email address for other people's calendars.

Use this before scheduling a meeting to find a time when all participants are free.

Example: Check if two people are free tomorrow afternoon:
```json
{
  "timeMin": "2026-04-06T13:00:00-04:00",
  "timeMax": "2026-04-06T17:00:00-04:00",
  "items": [{ "id": "primary" }, { "id": "colleague@example.com" }]
}
```
