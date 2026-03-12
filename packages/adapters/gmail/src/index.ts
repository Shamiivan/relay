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

export const searchInput = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(10).default(5),
});

export const searchSenderInput = z.object({
  sender: z.string().min(1),
  terms: z.array(z.string().min(1)).max(5).default([]),
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

const searchSenderDescriptor: ActionDescriptor = {
  tool: "gmail",
  operation: "search_sender",
  scope: "read",
};

const readDescriptor: ActionDescriptor = {
  tool: "gmail",
  operation: "read",
  scope: "read",
};

function toSenderQuery(sender: string, terms: string[]): string {
  const trimmedSender = sender.trim();
  const normalizedSender = trimmedSender.toLowerCase();
  const compactSender = normalizedSender.replace(/[^a-z0-9]/g, "");
  const quotedSender = `"${trimmedSender}"`;

  const senderTerms = new Set<string>([
    quotedSender,
    trimmedSender,
  ]);

  if (compactSender && compactSender !== normalizedSender) {
    senderTerms.add(compactSender);
  }

  if (/^[^\s@]+\.[^\s@]+$/.test(trimmedSender)) {
    senderTerms.add(`from:${trimmedSender}`);
  } else if (compactSender) {
    senderTerms.add(`from:${compactSender}.com`);
    senderTerms.add(`from:${compactSender}.io`);
  }

  const joinedSenderTerms = Array.from(senderTerms)
    .map((term) => (term.startsWith("from:") ? term : `"${String(term).replaceAll("\"", "")}"`))
    .join(" OR ");

  const extraTerms = terms.map((term) => `"${term.trim().replaceAll("\"", "")}"`).join(" ");
  return [joinedSenderTerms ? `(${joinedSenderTerms})` : "", extraTerms].filter(Boolean).join(" ");
}

export const gmailToolDeclarations = [
  {
    name: "gmail_search",
    description:
      "Search Gmail with a raw Gmail query. Use this when you already know the exact query syntax you want. For sender lookup, domain lookup, or company-name lookup, prefer gmail_search_sender.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The Gmail search query to run. Examples: from:digitalocean.com, receipt digitalocean, subject:\"invoice\" newer_than:30d.",
        },
        maxResults: {
          type: "integer",
          description: "Maximum messages to return, between 1 and 10.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "gmail_search_sender",
    description:
      "Search Gmail for messages from a sender, person, or company using structured input. This is the preferred tool when the user names a sender like DigitalOcean, Alice, Stripe, or GitHub.",
    parameters: {
      type: "object",
      properties: {
        sender: {
          type: "string",
          description: "Sender name, company name, email address, or domain fragment to search for.",
        },
        terms: {
          type: "array",
          description: "Optional extra keywords such as receipt, invoice, billing, welcome, or payment.",
          items: {
            type: "string",
          },
        },
        maxResults: {
          type: "integer",
          description: "Maximum messages to return, between 1 and 10.",
        },
      },
      required: ["sender"],
    },
  },
  {
    name: "gmail_read",
    description: "Read a specific Gmail message in full when you already know the Gmail message id.",
    parameters: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The Gmail message id to read.",
        },
      },
      required: ["messageId"],
    },
  },
] as const;

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
    searchSender: {
      descriptor: searchSenderDescriptor,
      async execute(
        input: z.input<typeof searchSenderInput>,
        env: GmailEnv,
      ): Promise<AdapterResult<GmailSearchResult>> {
        try {
          const parsed = searchSenderInput.parse(input);
          const query = toSenderQuery(parsed.sender, parsed.terms);
          return await gmail.actions.search.execute(
            {
              query,
              maxResults: parsed.maxResults,
            },
            env,
          );
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
