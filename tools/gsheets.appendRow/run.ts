import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../lib/google-auth";
import { readJsonInput, writeJsonOutput } from "../lib/json-stdio";

const inputSchema = z.object({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  values: z.array(z.string()).min(1),
  valueInputOption: z.enum(["RAW", "USER_ENTERED"]).default("USER_ENTERED"),
});

function classifyError(error: unknown) {
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
      return { type: "rate_limit", retryAfterMs: 60000 };
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

async function main() {
  try {
    const input = inputSchema.parse(await readJsonInput());
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

    writeJsonOutput({
      spreadsheetId: input.spreadsheetId,
      updatedRange: updates?.updatedRange ?? input.range,
      updatedRows: updates?.updatedRows ?? 0,
      updatedColumns: updates?.updatedColumns ?? 0,
      updatedCells: updates?.updatedCells ?? 0,
    });
  } catch (error) {
    writeJsonOutput({ error: classifyError(error) });
  }
}

void main();
