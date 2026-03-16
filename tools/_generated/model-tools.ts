import type { ModelTool } from "../../packages/model/src";
import { toolNames, type GeneratedToolName } from "./registry";

export const modelToolsByName = {
  "docs.read": {
    name: "docs.read",
    description: "Read a Google Docs document as plain text when you know the document id.",
    parameters: {
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
  },
  "docs.write": {
    name: "docs.write",
    description: "Replace the body text of a Google Docs document when you know the document id.",
    parameters: {
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
  },
  "drive.copy": {
    name: "drive.copy",
    description: "Copy a Google Drive file when you know the source file id.",
    parameters: {
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
  },
  "drive.getFile": {
    name: "drive.getFile",
    description: "Get Google Drive file metadata when you already know the Drive file id.",
    parameters: {
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
  },
  "drive.search": {
    name: "drive.search",
    description: "Search Google Drive files using Drive query syntax and return file metadata.",
    parameters: {
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
  },
  "gmail.read": {
    name: "gmail.read",
    description: "Read a specific Gmail message in full when you already know the Gmail message id.",
    parameters: {
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
  },
  "gmail.search": {
    name: "gmail.search",
    description: "Search Gmail with a raw Gmail query. Use this when you already know the exact query syntax you want.",
    parameters: {
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
  },
  "gsheets.readValues": {
    name: "gsheets.readValues",
    description: "Read cell values from a Google Sheets spreadsheet range using A1 notation.",
    parameters: {
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
  },
  "gsheets.appendRow": {
    name: "gsheets.appendRow",
    description: "Append one row of values to a Google Sheets spreadsheet range using A1 notation.",
    parameters: {
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
  },
  "terminal.bash": {
    name: "terminal.bash",
    description: "Run a bash command in the workspace and return stdout, stderr, and exit code. Supports pipes and shell syntax.",
    parameters: {
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
  },
  "terminal.applyPatch": {
    name: "terminal.applyPatch",
    description: "Create, modify, or delete files using the *** Begin Patch / *** End Patch format. Always read files with terminal.bash before patching.",
    parameters: {
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
  },
} as const satisfies Record<GeneratedToolName, ModelTool>;

export function getModelTools(toolNamesToLoad: readonly string[]): ModelTool[] {
  return toolNamesToLoad.map((toolName) => {
    const tool = modelToolsByName[toolName as GeneratedToolName];
    if (!tool) {
      throw new Error(`Unknown generated tool: ${toolName}`);
    }

    return tool;
  });
}

export const allModelTools = toolNames.map((name) => modelToolsByName[name]);
