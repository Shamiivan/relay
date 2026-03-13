/**
 * Google Sheets adapter surface for lightweight spreadsheet reads and row appends.
 */
import { google, type sheets_v4 } from "googleapis";
import { z } from "zod";
import type {
  ActionDescriptor,
  GSheetsAppendRowResult,
  GSheetsEnv,
  GSheetsReadValuesResult,
  NamedError,
  ToolAction,
  ToolProvider,
} from "../../../contracts/src";
import { getGoogleAuth } from "../../google-auth";

const readValuesInput = z.object({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  majorDimension: z.enum(["ROWS", "COLUMNS"]).default("ROWS"),
});

const appendRowInput = z.object({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  values: z.array(z.string()).min(1),
  valueInputOption: z.enum(["RAW", "USER_ENTERED"]).default("USER_ENTERED"),
});

function getClient(env: GSheetsEnv): sheets_v4.Sheets {
  return google.sheets({
    version: "v4",
    auth: getGoogleAuth(env),
  });
}

function classifyError(error: unknown): NamedError {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return {
      type: "validation",
      field: issue?.path.join(".") || "input",
      reason: issue?.message || "Invalid input",
    };
  }

  if (error instanceof Error) {
    if (/auth|credential|token/i.test(error.message)) {
      return { type: "auth_error" };
    }

    if (/429|rate/i.test(error.message)) {
      return { type: "rate_limit", retryAfterMs: 60_000 };
    }

    if (/404|not found/i.test(error.message)) {
      return { type: "not_found", id: "spreadsheet" };
    }
  }

  return {
    type: "external_error",
    message: error instanceof Error ? error.message : "Unknown Google Sheets error",
  };
}

function normalizeValues(values: unknown[][] | null | undefined): string[][] {
  return (values ?? []).map((row) => row.map((cell) => String(cell ?? "")));
}

const readValuesDescriptor: ActionDescriptor = {
  tool: "gsheets",
  operation: "readValues",
  scope: "read",
};

const readValuesAction: ToolAction<GSheetsEnv, GSheetsReadValuesResult> = {
  name: "gsheets.readValues",
  description:
    "Read cell values from a Google Sheets spreadsheet range using A1 notation.",
  parameters: {
    type: "object",
    properties: {
      spreadsheetId: {
        type: "string",
        description: "The Google Sheets spreadsheet id.",
      },
      range: {
        type: "string",
        description: "The A1 range to read, for example Sheet1!A1:D20.",
      },
      majorDimension: {
        type: "string",
        enum: ["ROWS", "COLUMNS"],
        description: "Whether values should be grouped by rows or columns.",
      },
    },
    required: ["spreadsheetId", "range"],
  },
  descriptor: readValuesDescriptor,
  inspectInput(input) {
    return readValuesInput.parse(input);
  },
  async execute(input, env) {
    try {
      const parsed = readValuesInput.parse(input);
      const client = getClient(env);
      const response = await client.spreadsheets.values.get({
        spreadsheetId: parsed.spreadsheetId,
        range: parsed.range,
        majorDimension: parsed.majorDimension,
      });

      return {
        ok: true,
        data: {
          spreadsheetId: parsed.spreadsheetId,
          range: response.data.range ?? parsed.range,
          majorDimension:
            response.data.majorDimension === "COLUMNS" ? "COLUMNS" : "ROWS",
          values: normalizeValues(response.data.values),
        },
      };
    } catch (error) {
      return { ok: false, error: classifyError(error) };
    }
  },
};

const appendRowDescriptor: ActionDescriptor = {
  tool: "gsheets",
  operation: "appendRow",
  scope: "write",
};

const appendRowAction: ToolAction<GSheetsEnv, GSheetsAppendRowResult> = {
  name: "gsheets.appendRow",
  description:
    "Append one row of values to a Google Sheets spreadsheet range using A1 notation.",
  parameters: {
    type: "object",
    properties: {
      spreadsheetId: {
        type: "string",
        description: "The Google Sheets spreadsheet id.",
      },
      range: {
        type: "string",
        description:
          "The A1 range to append within, for example Time Tracker!A:D.",
      },
      values: {
        type: "array",
        items: {
          type: "string",
        },
        description: "The ordered cell values for the new row.",
      },
      valueInputOption: {
        type: "string",
        enum: ["RAW", "USER_ENTERED"],
        description: "How Google Sheets should interpret the appended values.",
      },
    },
    required: ["spreadsheetId", "range", "values"],
  },
  descriptor: appendRowDescriptor,
  inspectInput(input) {
    return appendRowInput.parse(input);
  },
  async execute(input, env) {
    try {
      const parsed = appendRowInput.parse(input);
      const client = getClient(env);
      const response = await client.spreadsheets.values.append({
        spreadsheetId: parsed.spreadsheetId,
        range: parsed.range,
        valueInputOption: parsed.valueInputOption,
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          majorDimension: "ROWS",
          values: [parsed.values],
        },
      });
      const updates = response.data.updates;

      return {
        ok: true,
        data: {
          spreadsheetId: parsed.spreadsheetId,
          updatedRange: updates?.updatedRange ?? parsed.range,
          updatedRows: updates?.updatedRows ?? 0,
          updatedColumns: updates?.updatedColumns ?? 0,
          updatedCells: updates?.updatedCells ?? 0,
        },
      };
    } catch (error) {
      return { ok: false, error: classifyError(error) };
    }
  },
};

export const gsheets: ToolProvider<GSheetsEnv> = {
  id: "gsheets",
  actions: {
    readValues: readValuesAction,
    appendRow: appendRowAction,
  },
};
