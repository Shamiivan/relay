---
intent: instantly.email.search
description: Search Instantly email activity using API v2
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
---
Search and list email activity from Instantly API v2.

## Examples

```bash
printf '{"search":"welcome","limit":5}' | workflows/sales_prospect_research/tools/instantly.email.search/run
printf '{"campaignId":"019c0e38-c5be-70d5-b730-fdd27bea4548","eaccount":["sender@example.com"],"isUnread":true}' | workflows/sales_prospect_research/tools/instantly.email.search/run
```
