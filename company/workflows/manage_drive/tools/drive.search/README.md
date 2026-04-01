---
intent: drive.search
description: Search Google Drive files using Drive query syntax and return file metadata.
shared_tool: tools/gworkspace/drive/drive.search
prompt_ref: tools/gworkspace/drive/drive.search/prompt.md
mutates: false
destructive: false
fields:
  query: "string: A Google Drive query string"
  maxResults: "number: Maximum files to return (default 10)"
returns:
  files: "DriveFile[]: Returned files value"
  nextPageToken: "string: Token for the next Drive page when present"
---
`drive.search` searches Google Drive files using Drive query syntax and returns file metadata.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/gworkspace/drive/drive.search` implementation; inputs and outputs are identical.

See `tools/gworkspace/drive/drive.search/prompt.md` for deeper examples and operating guidance.
