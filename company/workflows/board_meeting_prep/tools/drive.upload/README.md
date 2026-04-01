---
intent: drive.upload
description: Upload a local file to Google Drive or mirror a local folder into Drive.
shared_tool: tools/gworkspace/drive/drive.upload
prompt_ref: tools/gworkspace/drive/drive.upload/prompt.md
mutates: true
destructive: false
fields:
  localPath: "string: Local workspace path to a file or folder"
  parentId: "string: Optional destination Drive folder id"
  name: "string: Optional top-level rename in Drive"
  recursive: "boolean: Upload folder contents recursively (default true)"
  mimeType: "string: Optional MIME type override for file uploads"
returns:
  kind: "'file' | 'folder': What kind of local path was uploaded"
  localPath: "string: Workspace-relative source path"
  resolvedLocalPath: "string: Absolute local source path"
  root: "DriveFile: The top-level Drive item that was created"
  uploadedFiles: "number: Count of file uploads performed"
  createdFolders: "number: Count of Drive folders created"
---
`drive.upload` uploads a local file to Google Drive or creates a Drive folder tree from a local folder.

Safety: mutates state. Run only when the requested upload destination and source path are explicit.

This workflow exposes the shared `tools/gworkspace/drive/drive.upload` implementation; inputs and outputs are identical.

See `tools/gworkspace/drive/drive.upload/prompt.md` for deeper examples and operating guidance.

## Examples

```bash
printf '{"localPath":"artifacts/board-deck.pdf","parentId":"1AbCdEf"}' | company/workflows/board_meeting_prep/tools/drive.upload/run
```

```bash
printf '{"localPath":"artifacts/meeting-pack","parentId":"1AbCdEf","recursive":true}' | company/workflows/board_meeting_prep/tools/drive.upload/run
```
