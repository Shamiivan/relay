import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool, toolErrorSchema } from "../../../sdk";

export const gsheetsAppendRowTool = defineTool({
  name: "gsheets.appendRow",
  resource: "gsheets",
  capability: "update",
  description: "Append one row of values to a Google Sheets spreadsheet range using A1 notation.",
  updateMode: "append",
  input: z.object({
    spreadsheetId: z.string().min(1).describe("The Google Sheets spreadsheet id."),
    range: z.string().min(1).describe(
      "The A1 range to append within, for example Time Tracker!A:D.",
    ),
    values: z.array(z.string()).min(1).describe("The ordered cell values for the new row."),
    valueInputOption: z.enum(["RAW", "USER_ENTERED"]).default("USER_ENTERED").describe(
      "How Google Sheets should interpret the appended values.",
    ),
  }),
  output: z.object({
    spreadsheetId: z.string().optional(),
    updatedRange: z.string().optional(),
    updatedRows: z.number().int().optional(),
    updatedColumns: z.number().int().optional(),
    updatedCells: z.number().int().optional(),
    error: toolErrorSchema.optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.sheets({
      version: "v4",
      auth: getGoogleAuth(),
    });
    const response = await client.spreadsheets.values.append({
      spreadsheetId: input.spreadsheetId,
      range: input.range,
      valueInputOption: input.valueInputOption,
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        majorDimension: "ROWS",
        values: [input.values],
      },
    });
    const updates = response.data.updates;

    return {
      spreadsheetId: input.spreadsheetId,
      updatedRange: updates?.updatedRange ?? input.range,
      updatedRows: updates?.updatedRows ?? 0,
      updatedColumns: updates?.updatedColumns ?? 0,
      updatedCells: updates?.updatedCells ?? 0,
    };
  },
  onError(error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return {
        error: {
          type: "validation",
          field: issue?.path.join(".") || "input",
          reason: issue?.message || "Invalid input",
        },
      };
    }

    if (error instanceof Error) {
      if (/auth|credential|token/i.test(error.message)) {
        return { error: { type: "auth_error" } };
      }

      if (/429|rate/i.test(error.message)) {
        return { error: { type: "rate_limit", retryAfterMs: 60000 } };
      }

      if (/404|not found/i.test(error.message)) {
        return { error: { type: "not_found", id: "spreadsheet" } };
      }
    }

    return {
      error: {
        type: "external_error",
        message: error instanceof Error ? error.message : "Unknown Google Sheets error",
      },
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(gsheetsAppendRowTool);
}
