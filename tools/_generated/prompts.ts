import { type GeneratedToolName } from "./registry";

export const toolPrompts = {
  "docs.read": "Use `docs.read` when you already know the Google Docs document id and need the document text.",
  "docs.write": "Use `docs.write` when you need to replace the full body text of a Google Docs document you already identified.",
  "drive.copy": "Use `drive.copy` when you already know which Drive file should be duplicated.\n\nGuidelines:\n- Set `name` explicitly rather than relying on Drive defaults.\n- Pass `parentId` when the copy should stay in a specific folder.\n- Use this after you have chosen a concrete source file.",
  "drive.getFile": "Use `drive.getFile` when `drive.search` already found a likely file and you need fuller metadata before answering.\n\nWhen you mention a Drive file, identify it with concrete metadata such as file name, mime type, modified time, and link when available.",
  "drive.search": "Use `drive.search` with Google Drive query syntax in the `query` field.\n\nUseful patterns:\n- `name contains 'invoice'`\n- `mimeType = 'application/pdf'`\n- `trashed = false`\n- `'me' in owners`\n\nSearch strategy:\n- Exclude trash unless the user explicitly asks for deleted files.\n- Prefer narrow file-name queries first when the likely name is known.\n- Filter by `mimeType` when the user wants a PDF, spreadsheet, folder, or Google Doc.",
  "gmail.read": "Use `gmail.read` after `gmail.search` when the search results are ambiguous or when you need the full body before answering.\n\nWhen you refer to a message after reading it, identify it with concrete metadata such as subject, sender, and date.",
  "gmail.search": "Use `gmail.search` with raw Gmail search syntax in the `query` field.\n\nUseful patterns:\n- `from:person@example.com`\n- `from:domain.com`\n- `subject:\"exact phrase\"`\n- `in:inbox`\n- `newer_than:30d`\n- free text like `receipt anthropic` or `invoice claude`\n\nSearch strategy:\n- For companies, try both brand-name queries and domain queries.\n- If one search fails, try 2-4 alternate queries before concluding nothing exists.\n- If the user is asking whether a message exists in the inbox, include `in:inbox`.\n- For billing questions, combine vendor terms with `receipt`, `invoice`, `subscription`, or `payment`.\n- Prefer narrow, concrete queries over broad ones when you already know the likely sender or subject.",
  "gsheets.readValues": "Use `gsheets.readValues` to inspect sheet structure or confirm existing rows before making changes.\n\nPrefer reading a small relevant range first when the column order or current values are unclear.",
  "gsheets.appendRow": "Use `gsheets.appendRow` to add one new row at the end of a sheet range.\n\nBefore appending, make sure you already know the column order.\nDo not ask for fields that are already clear from the session.\nAfter a successful append, mention the updated range.",
} as const satisfies Record<GeneratedToolName, string>;

export function getToolPrompt(toolName: string): string {
  return toolPrompts[toolName as GeneratedToolName] ?? "";
}
