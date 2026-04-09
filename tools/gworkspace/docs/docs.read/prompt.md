Use `docs.read` when you need the current plain-text body of a Google Docs document and you already know the document id.

Prefer `docs.read` before `docs.edit` or `docs.write` when you need to inspect the current wording first.

When the document has multiple tabs and the user references a tab URL or tab id, pass `tabId` so you read the intended tab instead of the default first tab.

Set `includeTabs` to `true` when you need the document's tab ids and titles before doing a tab-specific read or edit.
