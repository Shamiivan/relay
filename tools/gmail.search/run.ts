import { google, type gmail_v1 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../lib/google-auth";
import { readJsonInput, writeJsonOutput } from "../lib/json-stdio";

const inputSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(10).default(5),
});

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((header) => header.name === name)?.value ?? "";
}

function classifyError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return {
      type: "validation",
      field: issue?.path.join(".") || "input",
      reason: issue?.message || "Invalid input",
    };
  }

  if (error instanceof Error && /auth|credential|token/i.test(error.message)) {
    return { type: "auth_error" };
  }

  return {
    type: "external_error",
    message: error instanceof Error ? error.message : "Unknown Gmail error",
  };
}

async function main() {
  try {
    const input = inputSchema.parse(await readJsonInput());
    const client = google.gmail({
      version: "v1",
      auth: getGoogleAuth(),
    });
    const listResponse = await client.users.messages.list({
      userId: "me",
      q: input.query,
      maxResults: input.maxResults,
    });
    const ids = (listResponse.data.messages ?? [])
      .map((message) => message.id)
      .filter((value): value is string => Boolean(value));
    const emails = await Promise.all(
      ids.map(async (id) => {
        const message = await client.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });
        const headers = message.data.payload?.headers;
        return {
          id: message.data.id ?? id,
          threadId: message.data.threadId ?? "",
          subject: getHeader(headers, "Subject"),
          from: getHeader(headers, "From"),
          date: getHeader(headers, "Date"),
          snippet: message.data.snippet ?? "",
          unread: (message.data.labelIds ?? []).includes("UNREAD"),
        };
      }),
    );

    writeJsonOutput({
      emails,
      total: listResponse.data.resultSizeEstimate ?? emails.length,
    });
  } catch (error) {
    writeJsonOutput({ error: classifyError(error) });
  }
}

void main();
