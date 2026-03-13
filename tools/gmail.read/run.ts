import { google, type gmail_v1 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../lib/google-auth";
import { readJsonInput, writeJsonOutput } from "../lib/json-stdio";

const inputSchema = z.object({
  messageId: z.string().min(1),
});

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((header) => header.name === name)?.value ?? "";
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function extractBody(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) {
    return "";
  }

  if (part.body?.data && part.mimeType === "text/plain") {
    return decodeBase64Url(part.body.data);
  }

  for (const child of part.parts ?? []) {
    const text = extractBody(child);
    if (text) {
      return text;
    }
  }

  if (part.body?.data) {
    return decodeBase64Url(part.body.data);
  }

  return "";
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
    const message = await client.users.messages.get({
      userId: "me",
      id: input.messageId,
      format: "full",
    });
    const headers = message.data.payload?.headers;

    writeJsonOutput({
      id: message.data.id ?? input.messageId,
      threadId: message.data.threadId ?? "",
      subject: getHeader(headers, "Subject"),
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      date: getHeader(headers, "Date"),
      body: extractBody(message.data.payload),
      labels: message.data.labelIds ?? [],
    });
  } catch (error) {
    writeJsonOutput({ error: classifyError(error) });
  }
}

void main();
