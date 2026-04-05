Use `calendar.listInstances` to expand a recurring event into its individual occurrences.

The `eventId` must be the base event ID (not an instance ID). Use `timeMin`/`timeMax` to limit the range of instances returned.

Each instance has its own `id` that can be passed to `calendar.patchEvent` to modify just that occurrence.
