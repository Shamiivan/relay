---
intent: drive.copy
description: Copy a board-meeting reference document into a new working copy
fields:
  fileId: "string: The source Drive file id to copy (from drive.search results)"
  name: "string: The name for the copied file"
  parentId: "string: Optional destination folder id (omit to keep in same location)"
---
Copy a file in Google Drive. Returns the new file's id, name, mimeType, and webViewLink.

## Usage

Get the `fileId` from a `drive.search` result (the `id` field), then pipe it in:

```
printf '{"fileId":"1GkOrFXGIpgyz9o-...","name":"Mar 29, 2026 | Board Meeting"}' | workflows/board_meeting_prep/tools/drive.copy/run
```

With a destination folder:

```
printf '{"fileId":"1GkOrFXGIpgyz9o-...","name":"Mar 29, 2026 | Board Meeting","parentId":"1JWrFYXwH8RETmEKHdQJlCluQq6DRfugC"}' | workflows/board_meeting_prep/tools/drive.copy/run
```

## Output

```json
{
  "id": "new-file-id",
  "name": "Mar 29, 2026 | Board Meeting",
  "mimeType": "application/vnd.google-apps.document",
  "webViewLink": "https://docs.google.com/document/d/..."
}
```

Use the returned `id` as the `documentId` for `docs.read` or `docs.write`.
