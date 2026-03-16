import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool, toolErrorSchema } from "../../../sdk";

function normalizeValues(values: unknown[][] | null | undefined): string[][] {
  return (values ?? []).map((row) => row.map((cell) => String(cell ?? "")));
}

export const gsheetsReadValuesTool = defineTool({
  name: "gsheets.readValues",
  resource: "gsheets",
  capability: "read",
  description: "Read cell values from a Google Sheets spreadsheet range using A1 notation.",
  idempotent: true,
  input: z.object({
    spreadsheetId: z.string().min(1).describe("The Google Sheets spreadsheet id."),
    range: z.string().min(1).describe("The A1 range to read, for example Sheet1!A1:D20."),
    majorDimension: z.enum(["ROWS", "COLUMNS"]).default("ROWS").describe(
      "Whether values should be grouped by rows or columns.",
    ),
  }),
  output: z.object({
    spreadsheetId: z.string().optional(),
    range: z.string().optional(),
    majorDimension: z.enum(["ROWS", "COLUMNS"]).optional(),
    values: z.array(z.array(z.string())).optional(),
    error: toolErrorSchema.optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.sheets({
      version: "v4",
      auth: getGoogleAuth(),
    });
    const response = await client.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.range,
      majorDimension: input.majorDimension,
    });

    return {
      spreadsheetId: input.spreadsheetId,
      range: response.data.range ?? input.range,
      majorDimension: response.data.majorDimension === "COLUMNS" ? "COLUMNS" as const : "ROWS" as const,
      values: normalizeValues(response.data.values),
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
  void runDeclaredTool(gsheetsReadValuesTool);
}
