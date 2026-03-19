import { google, type gmail_v1 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((header) => header.name === name)?.value ?? "";
}

export const gmailSearchTool = defineTool({
  name: "gmail.search",
  resource: "gmail",
  capability: "search",
  description: "Search Gmail with a raw Gmail query. Use this when you already know the exact query syntax you want.",
  idempotent: true,
  input: z.object({
    query: z.string().min(1).describe(
      "The Gmail search query to run. Examples: from:digitalocean.com, receipt digitalocean, subject:\"invoice\" newer_than:30d.",
    ),
    maxResults: z.number().int().min(1).max(10).default(5).describe(
      "Maximum messages to return, between 1 and 10.",
    ),
  }),
  output: z.object({
    emails: z.array(z.object({
      id: z.string(),
      threadId: z.string(),
      subject: z.string(),
      from: z.string(),
      date: z.string(),
      snippet: z.string(),
      unread: z.boolean(),
    })).default([]),
    total: z.number().int().nonnegative().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
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

    return {
      emails,
      total: listResponse.data.resultSizeEstimate ?? emails.length,
    };
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof Error && /auth|credential|token/i.test(error.message)) {
      return { type: "auth_error" };
    }
    return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Gmail error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(gmailSearchTool);
}
