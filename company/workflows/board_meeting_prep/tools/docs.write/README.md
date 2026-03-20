---
intent: docs.write
description: Replace the body text of a Google Docs document when you know the document id.
shared_tool: tools/gworkspace/docs/docs.write
prompt_ref: tools/gworkspace/docs/docs.write/prompt.md
mutates: true
destructive: true
destructive_reason: Replaces the entire Google Docs body.
fields:
  documentId: "string: The Google Docs document id to write to"
  text: "string: The full replacement document body (plain text)"
returns:
  documentId: "string: Google Docs document identifier"
  updated: "boolean: True when the document write succeeded"
---
`docs.write` replaces the body text of a Google Docs document when you know the document id.

Safety: destructive mutation. Replaces the entire Google Docs body.

This workflow exposes the shared `tools/gworkspace/docs/docs.write` implementation; inputs and outputs are identical.

See `tools/gworkspace/docs/docs.write/prompt.md` for deeper examples and operating guidance.

## Rules

- Pass the complete document text — partial updates are not supported
- Preserve the existing structure and tone unless the user explicitly asks for changes
- Return plain text only — no markdown formatting

## Example

```bash
printf '{"documentId":"1GkOrFXGIpgyz9o-...","text":"Full updated document text here"}' | company/workflows/board_meeting_prep/tools/docs.write/run
```
