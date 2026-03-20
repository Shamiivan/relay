---
intent: docs.read
description: Read a Google Docs document as plain text when you know the document id.
shared_tool: tools/gworkspace/docs/docs.read
mutates: false
destructive: false
fields:
  documentId: "string: The Google Docs document id (from drive.search results)"
returns:
  documentId: "string: Google Docs document identifier"
  title: "string: Returned title value"
  text: "string: Google Docs body text"
---
`docs.read` reads a Google Docs document as plain text when you know the document id.

Safety: read-only operation. No records are created, updated, or deleted.

This workflow exposes the shared `tools/gworkspace/docs/docs.read` implementation; inputs and outputs are identical.

## Example

```bash
printf '{"documentId":"1GkOrFXGIpgyz9o-YfxCSknbybApmKYbTga92YelGIqw"}' | company/workflows/board_meeting_prep/tools/docs.read/run
```
