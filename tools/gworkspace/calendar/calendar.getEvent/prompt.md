Use `calendar.getEvent` to read full details of a single event, including reminders, recurrence, and creator.

Use this before `calendar.patchEvent` when you need to read the current attendee list to add or remove someone.

The `eventId` comes from `calendar.listEvents` results.
