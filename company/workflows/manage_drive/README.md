---
intent: manage_drive
description: Search, inspect, copy, and upload files and folders in Google Drive.
fields: {}
---

Use `manage_drive` for direct Google Drive operations.

Available tools:
- `drive.search` for finding files and folders with Drive query syntax
- `drive.getFile` for reading full metadata for one known Drive file id
- `drive.copy` for duplicating an existing Drive file
- `drive.upload` for uploading a local workspace file or folder into Drive

Rules:
- Keep concrete metadata attached to Drive items: file name, mime type, modified time, and link when available.
- Prefer `drive.search` before `drive.getFile` unless the user already supplied a Drive file id.
- Use `drive.copy` only when the source file is already known.
- Use `drive.upload` only when the local source path and Drive destination are explicit.
- Exclude trashed files unless the user explicitly asks for them.

Examples:

```bash
printf '{"query":"name contains '\''board'\'' and trashed = false","maxResults":5}' | company/workflows/manage_drive/tools/drive.search/run
```

```bash
printf '{"fileId":"1AbCdEf"}' | company/workflows/manage_drive/tools/drive.getFile/run
```

```bash
printf '{"fileId":"1AbCdEf","name":"Board Deck Copy","parentId":"1FolderId"}' | company/workflows/manage_drive/tools/drive.copy/run
```

```bash
printf '{"localPath":"artifacts/board-deck.pdf","parentId":"1FolderId"}' | company/workflows/manage_drive/tools/drive.upload/run
```
