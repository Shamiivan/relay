---
intent: drive.getFile
description: Get Google Drive file metadata when you already know the Drive file id.
shared_tool: tools/gworkspace/drive/drive.getFile
prompt_ref: tools/gworkspace/drive/drive.getFile/prompt.md
mutates: false
destructive: false
fields:
  fileId: "string: The Google Drive file id"
returns:
  id: "string: Resource identifier"
  name: "string: Resource name"
  mimeType: "string: Resource MIME type"
  description: "string: File description"
  webViewLink: "string: Browser URL for the resource"
  webContentLink: "string: Download URL when available"
  size: "string: File size in bytes when available"
  parents: "string[]: Parent folder identifiers"
  modifiedTime: "string: Last modified timestamp"
  createdTime: "string: Creation timestamp"
  shared: "boolean: Whether the file is shared"
  trashed: "boolean: Whether the file is trashed"
  driveId: "string: Shared drive identifier when present"
  owners: "Owner[]: Resource owners with display name and email"
---
`drive.getFile` fetches detailed metadata for one known Google Drive file id.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/gworkspace/drive/drive.getFile` implementation; inputs and outputs are identical.

See `tools/gworkspace/drive/drive.getFile/prompt.md` for deeper examples and operating guidance.
