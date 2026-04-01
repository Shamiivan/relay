Use `drive.upload` to send a local workspace file to Google Drive or mirror a local folder into Drive.

Guidelines:
- `localPath` must point to a file or folder inside the current workspace.
- Pass `parentId` when the upload should land in a specific Drive folder.
- For folders, leave `recursive` as `true` unless the user explicitly wants an empty Drive folder only.
- Use `name` only when you need to rename the top-level uploaded item.
