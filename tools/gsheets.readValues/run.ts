import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../lib/google-auth";
import { readJsonInput, writeJsonOutput } from "../lib/json-stdio";

const inputSchema = z.object({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  majorDimension: z.enum(["ROWS", "COLUMNS"]).default("ROWS"),
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

function normalizeValues(values: unknown[][] | null | undefined): string[][] {
  return (values ?? []).map((row) => row.map((cell) => String(cell ?? "")));
}

async function main() {
  try {
    const input = inputSchema.parse(await readJsonInput());
    const client = google.sheets({
      version: "v4",
      auth: getGoogleAuth(),
    });
    const response = await client.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.range,
      majorDimension: input.majorDimension,
    });

    writeJsonOutput({
      spreadsheetId: input.spreadsheetId,
      range: response.data.range ?? input.range,
      majorDimension: response.data.majorDimension === "COLUMNS" ? "COLUMNS" : "ROWS",
      values: normalizeValues(response.data.values),
    });
  } catch (error) {
    writeJsonOutput({ error: classifyError(error) });
  }
}

void main();
