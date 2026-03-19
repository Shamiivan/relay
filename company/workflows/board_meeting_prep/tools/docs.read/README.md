---
intent: docs.read
description: Read a specific Google Doc to inspect the board-meeting structure or content
fields:
  documentId: "string: The Google Docs document id (from drive.search results)"
---
Read a Google Docs document and return its plain text content with title and documentId.

## Usage

Get the `documentId` from a `drive.search` result (the `id` field), then pipe it in:

```
printf '{"documentId":"1GkOrFXGIpgyz9o-YfxCSknbybApmKYbTga92YelGIqw"}' | workflows/board_meeting_prep/tools/docs.read/run
```

## Output

```json
{
  "documentId": "1GkOrFXGIpgyz9o-...",
  "title": "Mar 22, 2026 | Board Meeting",
  "text": "Full plain text content of the document..."
}
```

Use the `text` field to read the document contents. The `documentId` is echoed back for reference.
