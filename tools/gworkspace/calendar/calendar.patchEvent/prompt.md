Use `calendar.patchEvent` to update specific fields of an existing event. Only the fields you provide are changed — omitted fields are left unchanged.

Important: The `attendees` field is a **full replacement**, not a merge. To add an attendee:
1. First use `calendar.getEvent` to read the current attendees.
2. Then call `calendar.patchEvent` with the full list including the new attendee.

To remove an attendee, read the event and patch with the attendee removed from the list.

Common updates:
- Reschedule: `{ eventId: "...", start: { dateTime: "..." }, end: { dateTime: "..." } }`
- Change title: `{ eventId: "...", summary: "New Title" }`
- Add location: `{ eventId: "...", location: "123 Main St" }`
