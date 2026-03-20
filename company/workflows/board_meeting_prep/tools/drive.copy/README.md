---
intent: drive.copy
description: Copy a Google Drive file when you know the source file id.
shared_tool: tools/gworkspace/drive/drive.copy
prompt_ref: tools/gworkspace/drive/drive.copy/prompt.md
mutates: true
destructive: false
fields:
  fileId: "string: The source Drive file id to copy (from drive.search results)"
  name: "string: The name for the copied file"
  parentId: "string: Optional destination folder id (omit to keep in same location)"
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

## Example

```bash
printf '{"fileId":"1GkOrFXGIpgyz9o-...","name":"Mar 29, 2026 | Board Meeting"}' | company/workflows/board_meeting_prep/tools/drive.copy/run
```
