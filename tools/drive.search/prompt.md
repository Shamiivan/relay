Use `drive.search` with Google Drive query syntax in the `query` field.

Useful patterns:
- `name contains 'invoice'`
- `mimeType = 'application/pdf'`
- `trashed = false`
- `'me' in owners`

Search strategy:
- Exclude trash unless the user explicitly asks for deleted files.
- Prefer narrow file-name queries first when the likely name is known.
- Filter by `mimeType` when the user wants a PDF, spreadsheet, folder, or Google Doc.
