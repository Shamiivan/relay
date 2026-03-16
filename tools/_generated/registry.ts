import type { ToolManifest } from "../sdk";
import { docsReadTool } from "../gworkspace/docs/docs.read/tool";
import { docsWriteTool } from "../gworkspace/docs/docs.write/tool";
import { driveCopyTool } from "../gworkspace/drive/drive.copy/tool";
import { driveGetFileTool } from "../gworkspace/drive/drive.getFile/tool";
import { driveSearchTool } from "../gworkspace/drive/drive.search/tool";
import { gmailReadTool } from "../gworkspace/gmail/gmail.read/tool";
import { gmailSearchTool } from "../gworkspace/gmail/gmail.search/tool";
import { gsheetsReadValuesTool } from "../gworkspace/gsheets/gsheets.readValues/tool";
import { gsheetsAppendRowTool } from "../gworkspace/gsheets/gsheets.appendRow/tool";
import { bashTool } from "../terminal/bash/tool";
import { applyPatchTool } from "../terminal/applyPatch/tool";

const manifests = {
  docs_read: {
  "name": "docs.read",
  "resource": "docs",
  "capability": "read",
  "description": "Read a Google Docs document as plain text when you know the document id.",
  "idempotent": true,
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "documentId": {
        "type": "string",
        "minLength": 1,
        "description": "The Google Docs document id."
      }
    },
    "required": [
      "documentId"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/gworkspace/docs/docs.read/tool.ts"
  ],
  "prompt": "Use `docs.read` when you already know the Google Docs document id and need the document text."
},
  docs_write: {
  "name": "docs.write",
  "resource": "docs",
  "capability": "update",
  "description": "Replace the body text of a Google Docs document when you know the document id.",
  "destructive": true,
  "updateMode": "replace",
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "documentId": {
        "type": "string",
        "minLength": 1,
        "description": "The Google Docs document id."
      },
      "text": {
        "type": "string",
        "description": "The full replacement body text for the document."
      }
    },
    "required": [
      "documentId",
      "text"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/gworkspace/docs/docs.write/tool.ts"
  ],
  "prompt": "Use `docs.write` when you need to replace the full body text of a Google Docs document you already identified."
},
  drive_copy: {
  "name": "drive.copy",
  "resource": "drive",
  "capability": "create",
  "description": "Copy a Google Drive file when you know the source file id.",
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "fileId": {
        "type": "string",
        "minLength": 1,
        "description": "The source Drive file id to copy."
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "description": "The name for the copied file."
      },
      "parentId": {
        "description": "Optional parent folder id for the copy. If omitted, Drive keeps the file in its default location.",
        "type": "string",
        "minLength": 1
      }
    },
    "required": [
      "fileId",
      "name"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/gworkspace/drive/drive.copy/tool.ts"
  ],
  "prompt": "Use `drive.copy` when you already know which Drive file should be duplicated.\n\nGuidelines:\n- Set `name` explicitly rather than relying on Drive defaults.\n- Pass `parentId` when the copy should stay in a specific folder.\n- Use this after you have chosen a concrete source file."
},
  drive_getFile: {
  "name": "drive.getFile",
  "resource": "drive",
  "capability": "read",
  "description": "Get Google Drive file metadata when you already know the Drive file id.",
  "idempotent": true,
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "fileId": {
        "type": "string",
        "minLength": 1,
        "description": "The Google Drive file id."
      }
    },
    "required": [
      "fileId"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/gworkspace/drive/drive.getFile/tool.ts"
  ],
  "prompt": "Use `drive.getFile` when `drive.search` already found a likely file and you need fuller metadata before answering.\n\nWhen you mention a Drive file, identify it with concrete metadata such as file name, mime type, modified time, and link when available."
},
  drive_search: {
  "name": "drive.search",
  "resource": "drive",
  "capability": "search",
  "description": "Search Google Drive files using Drive query syntax and return file metadata.",
  "idempotent": true,
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "minLength": 1,
        "description": "The Google Drive search query to run, for example name contains 'invoice' and trashed = false."
      },
      "maxResults": {
        "default": 10,
        "description": "Maximum files to return, between 1 and 20.",
        "type": "integer",
        "minimum": 1,
        "maximum": 20
      }
    },
    "required": [
      "query"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/gworkspace/drive/drive.search/tool.ts"
  ],
  "prompt": "Use `drive.search` with Google Drive query syntax in the `query` field.\n\nUseful patterns:\n- `name contains 'invoice'`\n- `mimeType = 'application/pdf'`\n- `trashed = false`\n- `'me' in owners`\n\nSearch strategy:\n- Exclude trash unless the user explicitly asks for deleted files.\n- Prefer narrow file-name queries first when the likely name is known.\n- Filter by `mimeType` when the user wants a PDF, spreadsheet, folder, or Google Doc."
},
  gmail_read: {
  "name": "gmail.read",
  "resource": "gmail",
  "capability": "read",
  "description": "Read a specific Gmail message in full when you already know the Gmail message id.",
  "idempotent": true,
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "messageId": {
        "type": "string",
        "minLength": 1,
        "description": "The Gmail message id to read."
      }
    },
    "required": [
      "messageId"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/gworkspace/gmail/gmail.read/tool.ts"
  ],
  "prompt": "Use `gmail.read` after `gmail.search` when the search results are ambiguous or when you need the full body before answering.\n\nWhen you refer to a message after reading it, identify it with concrete metadata such as subject, sender, and date."
},
  gmail_search: {
  "name": "gmail.search",
  "resource": "gmail",
  "capability": "search",
  "description": "Search Gmail with a raw Gmail query. Use this when you already know the exact query syntax you want.",
  "idempotent": true,
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "minLength": 1,
        "description": "The Gmail search query to run. Examples: from:digitalocean.com, receipt digitalocean, subject:\"invoice\" newer_than:30d."
      },
      "maxResults": {
        "default": 5,
        "description": "Maximum messages to return, between 1 and 10.",
        "type": "integer",
        "minimum": 1,
        "maximum": 10
      }
    },
    "required": [
      "query"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/gworkspace/gmail/gmail.search/tool.ts"
  ],
  "prompt": "Use `gmail.search` with raw Gmail search syntax in the `query` field.\n\nUseful patterns:\n- `from:person@example.com`\n- `from:domain.com`\n- `subject:\"exact phrase\"`\n- `in:inbox`\n- `newer_than:30d`\n- free text like `receipt anthropic` or `invoice claude`\n\nSearch strategy:\n- For companies, try both brand-name queries and domain queries.\n- If one search fails, try 2-4 alternate queries before concluding nothing exists.\n- If the user is asking whether a message exists in the inbox, include `in:inbox`.\n- For billing questions, combine vendor terms with `receipt`, `invoice`, `subscription`, or `payment`.\n- Prefer narrow, concrete queries over broad ones when you already know the likely sender or subject."
},
  gsheets_readValues: {
  "name": "gsheets.readValues",
  "resource": "gsheets",
  "capability": "read",
  "description": "Read cell values from a Google Sheets spreadsheet range using A1 notation.",
  "idempotent": true,
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "spreadsheetId": {
        "type": "string",
        "minLength": 1,
        "description": "The Google Sheets spreadsheet id."
      },
      "range": {
        "type": "string",
        "minLength": 1,
        "description": "The A1 range to read, for example Sheet1!A1:D20."
      },
      "majorDimension": {
        "default": "ROWS",
        "description": "Whether values should be grouped by rows or columns.",
        "type": "string",
        "enum": [
          "ROWS",
          "COLUMNS"
        ]
      }
    },
    "required": [
      "spreadsheetId",
      "range"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/gworkspace/gsheets/gsheets.readValues/tool.ts"
  ],
  "prompt": "Use `gsheets.readValues` to inspect sheet structure or confirm existing rows before making changes.\n\nPrefer reading a small relevant range first when the column order or current values are unclear."
},
  gsheets_appendRow: {
  "name": "gsheets.appendRow",
  "resource": "gsheets",
  "capability": "update",
  "description": "Append one row of values to a Google Sheets spreadsheet range using A1 notation.",
  "updateMode": "append",
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "spreadsheetId": {
        "type": "string",
        "minLength": 1,
        "description": "The Google Sheets spreadsheet id."
      },
      "range": {
        "type": "string",
        "minLength": 1,
        "description": "The A1 range to append within, for example Time Tracker!A:D."
      },
      "values": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "The ordered cell values for the new row."
      },
      "valueInputOption": {
        "default": "USER_ENTERED",
        "description": "How Google Sheets should interpret the appended values.",
        "type": "string",
        "enum": [
          "RAW",
          "USER_ENTERED"
        ]
      }
    },
    "required": [
      "spreadsheetId",
      "range",
      "values"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/gworkspace/gsheets/gsheets.appendRow/tool.ts"
  ],
  "prompt": "Use `gsheets.appendRow` to add one new row at the end of a sheet range.\n\nBefore appending, make sure you already know the column order.\nDo not ask for fields that are already clear from the session.\nAfter a successful append, mention the updated range."
},
  terminal_bash: {
  "name": "terminal.bash",
  "resource": "terminal",
  "capability": "read",
  "description": "Run a bash command in the workspace and return stdout, stderr, and exit code. Supports pipes and shell syntax.",
  "idempotent": false,
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "command": {
        "type": "string",
        "minLength": 1,
        "description": "Full bash command to run. Supports pipes, redirects, and shell built-ins."
      },
      "cwd": {
        "description": "Working directory relative to workspace root. Defaults to workspace root.",
        "type": "string"
      }
    },
    "required": [
      "command"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/terminal/bash/tool.ts"
  ],
  "prompt": "Use `terminal.bash` to run shell commands in the workspace.\n\nCommon uses:\n- Read files: `cat src/utils.ts`\n- List directories: `ls -la`\n- Search code: `grep -r \"pattern\" src/` or `rg \"pattern\"`\n- Run tests: `npx vitest run src/foo.test.ts`\n- Git operations: `git status`, `git diff`\n- Install / build: `pnpm install`, `pnpm build`\n\nAlways read files with `terminal.bash` before patching them.\nCheck exit code and stderr to detect failures."
},
  terminal_applyPatch: {
  "name": "terminal.applyPatch",
  "resource": "terminal",
  "capability": "update",
  "description": "Create, modify, or delete files using the *** Begin Patch / *** End Patch format. Always read files with terminal.bash before patching.",
  "destructive": true,
  "parameters": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "patch": {
        "type": "string",
        "minLength": 1,
        "description": "Patch content in the *** Begin Patch / *** End Patch format. Paths must be relative. Include 3 lines of context above and below each change."
      }
    },
    "required": [
      "patch"
    ]
  },
  "command": [
    "pnpm",
    "tsx",
    "tools/terminal/applyPatch/tool.ts"
  ],
  "prompt": "Use `terminal.applyPatch` to create, modify, or delete files.\n\n**Always read files with `terminal.bash` before patching.**\n\nPatch format:\n```\n*** Begin Patch\n*** Add File: path/to/new/file.ts\n+line one\n+line two\n*** Update File: path/to/existing.ts\n@@ context hint (a nearby unchanged line)\n context line\n context line\n context line\n-old line to remove\n+new line to add\n context line\n context line\n context line\n*** Delete File: path/to/remove.ts\n*** End Patch\n```\n\nRules:\n- Paths must be **relative** (never absolute)\n- Include **3 lines of context** above and below each change\n- Use `*** Move to: new/path.ts` after `*** Update File:` to rename\n- The `@@ hint` line anchors the position in the file"
},
} as const satisfies Record<string, ToolManifest>;

export const toolRegistry = {
  "docs.read": manifests.docs_read,
  "docs.write": manifests.docs_write,
  "drive.copy": manifests.drive_copy,
  "drive.getFile": manifests.drive_getFile,
  "drive.search": manifests.drive_search,
  "gmail.read": manifests.gmail_read,
  "gmail.search": manifests.gmail_search,
  "gsheets.readValues": manifests.gsheets_readValues,
  "gsheets.appendRow": manifests.gsheets_appendRow,
  "terminal.bash": manifests.terminal_bash,
  "terminal.applyPatch": manifests.terminal_applyPatch,
} as const;

export const declaredTools = {
  "docs.read": docsReadTool,
  "docs.write": docsWriteTool,
  "drive.copy": driveCopyTool,
  "drive.getFile": driveGetFileTool,
  "drive.search": driveSearchTool,
  "gmail.read": gmailReadTool,
  "gmail.search": gmailSearchTool,
  "gsheets.readValues": gsheetsReadValuesTool,
  "gsheets.appendRow": gsheetsAppendRowTool,
  "terminal.bash": bashTool,
  "terminal.applyPatch": applyPatchTool,
} as const;

export const toolNames = Object.freeze(Object.keys(toolRegistry)) as readonly (keyof typeof toolRegistry)[];

export type GeneratedToolName = keyof typeof toolRegistry;

export function getTool(name: string): ToolManifest | undefined {
  return toolRegistry[name as GeneratedToolName];
}

export const allTools = Object.freeze(
  [...toolNames].map((name) => toolRegistry[name]),
);
