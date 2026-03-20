---
intent: instantly.email.search
description: Search Instantly email activity using the API v2 emails endpoint.
shared_tool: tools/instantly/email/instantly.email.search
prompt_ref: tools/instantly/email/instantly.email.search/prompt.md
mutates: false
destructive: false
fields:
  limit: "number: Maximum emails to return, from 1 to 100 (default 10)"
  startingAfter: "string: Pagination cursor from a previous response"
  search: "string: Free-text search across email activity"
  campaignId: "string(uuid): Filter to a single campaign ID"
  listId: "string(uuid): Filter to a single list ID"
  iStatus: "number: Instantly email status filter"
  eaccount: "string[]: Filter by sending account email addresses"
  isUnread: "boolean: Filter by unread state"
  hasReminder: "boolean: Filter by reminder presence"
  mode: "string: emode_focused | emode_others | emode_all"
  previewOnly: "boolean: Return preview payloads only"
  sortOrder: "string: asc | desc"
  scheduledOnly: "boolean: Return only scheduled emails"
  assignedTo: "string(uuid): Filter by assigned user ID"
  lead: "string(email): Filter by lead email address"
  companyDomain: "string: Filter by company domain"
  markedAsDone: "boolean: Filter by done state"
  emailType: "string: received | sent | manual"
  minTimestampCreated: "string: Lower timestamp bound"
  maxTimestampCreated: "string: Upper timestamp bound"
returns:
  emails: "Email[]: Normalized email activity records"
  nextStartingAfter: "string: Cursor for the next page when present"
---
`instantly.email.search` searches Instantly email activity using the API v2 emails endpoint.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/instantly/email/instantly.email.search` implementation; inputs and outputs are identical.

See `tools/instantly/email/instantly.email.search/prompt.md` for deeper examples and operating guidance.

## Example

```bash
printf '{"search":"welcome","limit":5}' | workflows/sales_prospect_research/tools/instantly.email.search/run
```
