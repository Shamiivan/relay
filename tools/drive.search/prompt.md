Use `drive.search` with Google Drive query syntax in the `query` field.

Useful patterns:
- `name contains 'invoice'`
- `mimeType = 'application/pdf'`
- `'me' in owners`
- `trashed = false`
- `modifiedTime > '2026-01-01T00:00:00'`
- combine clauses like `name contains 'anthropic' and trashed = false`

Search strategy:
- Exclude trash unless the user explicitly asks for deleted files.
- Prefer narrow file-name queries first when the likely name is known.
- Filter by `mimeType` when the user wants a PDF, spreadsheet, folder, or Google Doc.
- If one search is too broad, add owner or modified-time filters before giving up.
