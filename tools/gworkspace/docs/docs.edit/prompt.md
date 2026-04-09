Use `docs.edit` for surgical Google Docs changes when a full-body replacement is too destructive.

Prefer `docs.edit` when you need to:
- replace one exact phrase or section without touching the rest of the document
- insert new text before or after known text
- delete one exact range or match
- apply text formatting such as bold, italic, links, colors, or font size
- apply paragraph formatting such as headings, alignment, spacing, or indents
- create or remove bullets

Operational guidance:
- Use `drive.search` first when you need to find the document id.
- Use `docs.read` before editing when you need the current wording to target exact text safely.
- When the user gives a Google Docs tab URL or tab id, pass it as `tabId` so the edit is scoped to that tab instead of the default first tab.
- Prefer exact text anchors over raw index ranges unless you already know the Docs indexes.
- Keep operations narrow and ordered. Later operations run after earlier ones.
- Use `docs.write` only when the user explicitly wants to replace the full document body.

Example:

```json
{
  "documentId": "1AbCdEf",
  "tabId": "t.dhx43q2fmmbo",
  "operations": [
    {
      "op": "replaceText",
      "target": { "kind": "text", "text": "Q1 draft", "occurrence": 1, "matchCase": true },
      "replacement": "Q1 final",
      "replaceAll": false
    },
    {
      "op": "formatParagraph",
      "target": { "kind": "text", "text": "Board Update", "occurrence": 1, "matchCase": true },
      "paragraphStyle": { "namedStyleType": "HEADING_1", "spaceBelowPt": 12 }
    },
    {
      "op": "formatText",
      "target": { "kind": "text", "text": "Action required", "occurrence": 1, "matchCase": true },
      "textStyle": { "bold": true, "foregroundColor": { "red": 0.8, "green": 0.1, "blue": 0.1 } }
    }
  ]
}
```
