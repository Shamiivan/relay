---
intent: drive.copy
description: Copy a Google Drive file when you know the source file id.
shared_tool: tools/gworkspace/drive/drive.copy
prompt_ref: tools/gworkspace/drive/drive.copy/prompt.md
mutates: true
destructive: false
fields:
  fileId: "string: The source Drive file id"
  name: "string: The name for the copied file"
  parentId: "string: Optional destination folder id"
returns:
  id: "string: Resource identifier"
  name: "string: Resource name"
  mimeType: "string: Resource MIME type"
  webViewLink: "string: Browser URL for the resource"
  parents: "string[]: Parent folder identifiers"
  modifiedTime: "string: Last modified timestamp"
  driveId: "string: Shared drive identifier when present"
  owners: "Owner[]: Resource owners with display name and email"
---
`drive.copy` copies a Google Drive file when you know the source file id.

Safety: mutates state. Run only when the requested change is explicit.

This workflow exposes the shared `tools/gworkspace/drive/drive.copy` implementation; inputs and outputs are identical.

See `tools/gworkspace/drive/drive.copy/prompt.md` for deeper examples and operating guidance.
