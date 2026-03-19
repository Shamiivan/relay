---
intent: drive.search
description: Search Google Drive for board-meeting-related folders and documents
fields:
  query: "string: A Google Drive query string (NOT a plain keyword — see examples below)"
  maxResults: "number: Maximum files to return (default 10)"
---
Search Google Drive using Google Drive query syntax. Returns files with id, name, mimeType, webViewLink, parents, modifiedTime, driveId, and owners.

## Query syntax — MUST use Drive operators, not plain text

| Want | Query |
|------|-------|
| File name contains word | `name contains 'board'` |
| File name contains phrase | `name contains 'board meeting'` |
| Full-text search | `fullText contains 'quarterly results'` |
| Google Doc only | `mimeType = 'application/vnd.google-apps.document'` |
| Exclude trash | `trashed = false` |
| Combine conditions | `name contains 'board' and trashed = false` |

## Examples

```
printf '{"query":"name contains '\''board'\''","maxResults":5}' | workflows/board_meeting_prep/tools/drive.search/run
printf '{"query":"name contains '\''board meeting'\'' and trashed = false"}' | workflows/board_meeting_prep/tools/drive.search/run
```

Plain strings like `"board"` or `"march 22"` are NOT valid — always use an operator like `name contains '...'`.
