---
intent: manage_docs
description: Find, inspect, copy, and surgically edit Google Docs documents.
fields: {}
---

Use `manage_docs` for Google Docs work.

## Available tools

### drive.search

Search Google Drive for documents and folders. Use this first when the user refers to a doc by name instead of id.

### drive.getFile

Read full metadata for one known Drive file id, including mime type, parent folder ids, modified time, owners, and link.

### drive.copy

Duplicate an existing Google Doc or other Drive file into a working copy before making edits.

### docs.read

Read a Google Doc as plain text when you know the document id.

```bash
printf '{"documentId":"1AbCdEf"}' | company/workflows/manage_docs/tools/docs.read
```

### docs.write

Replace the full Google Doc body text. Use only when the user explicitly wants a full rewrite.

```bash
printf '{"documentId":"1AbCdEf","text":"Full replacement body"}' | company/workflows/manage_docs/tools/docs.write
```

### docs.edit

Apply surgical edits and formatting changes without replacing the entire document body.

Supported operations:
- `replaceText`
- `insertText`
- `deleteText`
- `formatText`
- `formatParagraph`
- `createBullets`
- `deleteBullets`

```bash
printf '{"documentId":"1AbCdEf","operations":[{"op":"replaceText","target":{"kind":"text","text":"Q1 draft","occurrence":1,"matchCase":true},"replacement":"Q1 final","replaceAll":false}]}' | company/workflows/manage_docs/tools/docs.edit
```

## Rules

- Use `drive.search` first when the document is known by title rather than id.
- Prefer `docs.read` before mutating a document so edits can anchor to the current text safely.
- Prefer `docs.edit` for targeted revisions, formatting, headings, bullets, and small insertions.
- Reserve `docs.write` for intentional full-body replacement.
- Copy the source doc with `drive.copy` first when the user wants a draft instead of mutating the original.
