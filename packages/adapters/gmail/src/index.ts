/**
 * Gmail adapter surface for the first email use case.
 * Start with read-oriented actions and add send later with approval.
 */
import { google, type gmail_v1 } from "googleapis";
import { z } from "zod";
import type {
  ActionDescriptor,
  AdapterResult,
  GmailEmailSummary,
  GmailEnv,
  GmailMessage,
  GmailSearchResult,
  NamedError,
} from "../../../contracts/src";
import { getGoogleAuth } from "./google-auth";

const userId = "me";

const searchInput = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(10).default(5),
});

export const readInput = z.object({
  messageId: z.string().min(1),
});

function getClient(env: GmailEnv): gmail_v1.Gmail {
  return google.gmail({
    version: "v1",
    auth: getGoogleAuth(env),
  });
}

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

function classifyError(error: unknown): NamedError {
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

const searchDescriptor: ActionDescriptor = {
  tool: "gmail",
  operation: "search",
  scope: "read",
};

const readDescriptor: ActionDescriptor = {
  tool: "gmail",
  operation: "read",
  scope: "read",
};

export const gmail = {
  id: "gmail",
  actions: {
    search: {
      descriptor: searchDescriptor,
      async execute(
        input: z.input<typeof searchInput>,
        env: GmailEnv,
      ): Promise<AdapterResult<GmailSearchResult>> {
        try {
          const parsed = searchInput.parse(input);
          const client = getClient(env);
          const listResponse = await client.users.messages.list({
            userId,
            q: parsed.query,
            maxResults: parsed.maxResults,
          });

          const ids = (listResponse.data.messages ?? [])
            .map((message) => message.id)
            .filter((value): value is string => Boolean(value));

          const emails: GmailEmailSummary[] = await Promise.all(
            ids.map(async (id) => {
              const message = await client.users.messages.get({
                userId,
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
            ok: true,
            data: {
              emails,
              total: listResponse.data.resultSizeEstimate ?? emails.length,
            },
          };
        } catch (error) {
          return { ok: false, error: classifyError(error) };
        }
      },
    },
    read: {
      descriptor: readDescriptor,
      async execute(
        input: z.input<typeof readInput>,
        env: GmailEnv,
      ): Promise<AdapterResult<GmailMessage>> {
        try {
          const parsed = readInput.parse(input);
          const client = getClient(env);
          const message = await client.users.messages.get({
            userId,
            id: parsed.messageId,
            format: "full",
          });
          const headers = message.data.payload?.headers;

          return {
            ok: true,
            data: {
              id: message.data.id ?? parsed.messageId,
              threadId: message.data.threadId ?? "",
              subject: getHeader(headers, "Subject"),
              from: getHeader(headers, "From"),
              to: getHeader(headers, "To"),
              date: getHeader(headers, "Date"),
              body: extractBody(message.data.payload),
              labels: message.data.labelIds ?? [],
            },
          };
        } catch (error) {
          return { ok: false, error: classifyError(error) };
        }
      },
    },
  },
};
