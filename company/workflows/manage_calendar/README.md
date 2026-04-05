---
intent: manage_calendar
description: List calendars, create and manage events, check availability, and manage calendar sharing.
fields: {}
---

Use `manage_calendar` for Google Calendar operations.

Run tools with: `printf '<json>' | company/workflows/manage_calendar/tools/<tool>`

## Available tools

### time.now
Get the current date and time. Use this before any date-relative operation.

```bash
printf '{}' | company/workflows/manage_calendar/tools/time.now
```

### calendar.listCalendars
List the user's visible calendars. Returns `id`, `summary`, `primary`, `accessRole`, `timeZone`. Use the `id` to pass as `calendarId` to other tools.

```bash
printf '{}' | company/workflows/manage_calendar/tools/calendar.listCalendars
```

### calendar.listEvents
List events with optional date range and text filters. Defaults to primary calendar, singleEvents=true, orderBy=startTime.

Fields: `calendarId?`, `timeMin?` (RFC3339), `timeMax?` (RFC3339), `query?`, `maxResults?` (default 10), `singleEvents?` (default true), `orderBy?`

```bash
printf '{"timeMin":"2026-04-05T00:00:00Z","timeMax":"2026-04-06T00:00:00Z"}' | company/workflows/manage_calendar/tools/calendar.listEvents
```

### calendar.createEvent
Create a new event with optional attendees, reminders, and recurrence. Uses `dateTime` for timed events, `date` for all-day.

Fields: `calendarId?`, `summary`, `start`, `end`, `description?`, `location?`, `attendees?`, `reminders?`, `recurrence?`, `sendUpdates?` (default "all")

```bash
printf '{"summary":"Team Standup","start":{"dateTime":"2026-04-07T09:00:00","timeZone":"America/Toronto"},"end":{"dateTime":"2026-04-07T09:30:00","timeZone":"America/Toronto"}}' | company/workflows/manage_calendar/tools/calendar.createEvent
```

### calendar.patchEvent
Update specific fields of an existing event. Only provided fields are changed. Attendees is a full replacement — read the event first to add/remove attendees.

Fields: `calendarId?`, `eventId`, `summary?`, `start?`, `end?`, `description?`, `location?`, `attendees?`, `reminders?`, `sendUpdates?`

```bash
printf '{"eventId":"abc123","summary":"Renamed Event"}' | company/workflows/manage_calendar/tools/calendar.patchEvent
```

### calendar.getEvent
Get full details of a single event by ID, including reminders, recurrence, and creator info.

Fields: `calendarId?`, `eventId`

```bash
printf '{"eventId":"abc123"}' | company/workflows/manage_calendar/tools/calendar.getEvent
```

### calendar.freebusy
Check availability for one or more calendars in a time range. Returns busy time slots.

Fields: `timeMin`, `timeMax`, `items` (array of `{id}`), `timeZone?`

```bash
printf '{"timeMin":"2026-04-06T13:00:00Z","timeMax":"2026-04-06T17:00:00Z","items":[{"id":"primary"}]}' | company/workflows/manage_calendar/tools/calendar.freebusy
```

### calendar.quickAddEvent
Create an event from natural language text. Google parses time, date, and title automatically.

Fields: `calendarId?`, `text`, `sendUpdates?`

```bash
printf '{"text":"Lunch with Alice tomorrow at noon"}' | company/workflows/manage_calendar/tools/calendar.quickAddEvent
```

### calendar.deleteEvent
Delete a calendar event. **Destructive** — cannot be undone.

Fields: `calendarId?`, `eventId`, `sendUpdates?`

```bash
printf '{"eventId":"abc123","sendUpdates":"none"}' | company/workflows/manage_calendar/tools/calendar.deleteEvent
```

### calendar.shareCalendar
Grant another user access to a calendar. Roles: freeBusyReader, reader, writer, owner.

Fields: `calendarId`, `email`, `role`, `sendNotifications?` (default true)

```bash
printf '{"calendarId":"shamiivan@gmail.com","email":"alice@example.com","role":"reader"}' | company/workflows/manage_calendar/tools/calendar.shareCalendar
```

### calendar.listSharing
List who has access to a calendar and their roles. Returns rule IDs needed by removeSharing.

Fields: `calendarId`

```bash
printf '{"calendarId":"shamiivan@gmail.com"}' | company/workflows/manage_calendar/tools/calendar.listSharing
```

### calendar.removeSharing
Revoke a user's access to a calendar. **Destructive**.

Fields: `calendarId`, `ruleId`

```bash
printf '{"calendarId":"shamiivan@gmail.com","ruleId":"user:alice@example.com"}' | company/workflows/manage_calendar/tools/calendar.removeSharing
```

### calendar.moveEvent
Move an event from one calendar to another.

Fields: `calendarId?`, `eventId`, `destinationCalendarId`, `sendUpdates?`

```bash
printf '{"eventId":"abc123","destinationCalendarId":"work-cal-id"}' | company/workflows/manage_calendar/tools/calendar.moveEvent
```

### calendar.listInstances
Expand a recurring event into its individual occurrences within a time range.

Fields: `calendarId?`, `eventId`, `timeMin?`, `timeMax?`, `maxResults?` (default 25)

```bash
printf '{"eventId":"recurring-evt-id","timeMin":"2026-04-01T00:00:00Z","timeMax":"2026-04-30T00:00:00Z"}' | company/workflows/manage_calendar/tools/calendar.listInstances
```

## Rules

- Always run `time.now` first to get the current date/time and `timeZone` before any date-relative query.
- Use the `timeZone` from `time.now` (e.g. `America/Toronto`) in the `start.timeZone` and `end.timeZone` fields. Do NOT use `Z` (UTC) — use plain local datetimes with the timeZone field instead.
- Example: user says "6pm" and time.now returns `timeZone: "America/Toronto"` → use `start: { dateTime: "2026-04-05T18:00:00", timeZone: "America/Toronto" }`.
- Default `calendarId` to `"primary"` unless the user specifies another calendar.
- Use `calendar.listCalendars` first when the user refers to a calendar by name.
- When adding/removing attendees, first read the event, then patch with the full attendee list.
- Set `sendUpdates: "all"` (default) when creating events with attendees so they receive invitations.
