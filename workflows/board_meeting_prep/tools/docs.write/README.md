---
intent: docs.write
description: Replace the working board-meeting Google Doc with the revised content
fields:
  documentId: "string: The Google Docs document id to write to"
  text: "string: The full replacement document body (plain text)"
---
Replace the full content of a Google Docs document with new text. This is destructive — it overwrites the entire body.

## Usage

Always read the document first with `docs.read`, revise the text, then write it back:

```
printf '{"documentId":"1GkOrFXGIpgyz9o-...","text":"Full updated document text here"}' | workflows/board_meeting_prep/tools/docs.write/run
```

## Output

```json
{ "documentId": "1GkOrFXGIpgyz9o-...", "success": true }
```

## Rules

- Pass the complete document text — partial updates are not supported
- Preserve the existing structure and tone unless the user explicitly asks for changes
- Return plain text only — no markdown formatting
