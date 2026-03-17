import { google, type gmail_v1 } from "googleapis";
import { z } from "zod";
import { defineIntent, field } from "../../../../runtime/src/execution/determine-next-step/contract.ts";
import { getGoogleAuth } from "../../../lib/google-auth";
import { toolErrorSchema } from "../../../sdk";
import { Tool, runPromptBackedTool } from "../../../sdk-class";

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((header) => header.name === name)?.value ?? "";
}

const gmailSearchPocInput = z.object({
  query: z.string().min(1).describe(
    "The Gmail search query to run. Examples: from:digitalocean.com, receipt digitalocean, subject:\"invoice\" newer_than:30d.",
  ),
  maxResults: z.number().int().min(1).max(10).default(5).describe(
    "Maximum messages to return, between 1 and 10.",
  ),
});

const gmailSearchPocEmail = z.object({
  id: z.string(),
  threadId: z.string(),
  subject: z.string(),
  from: z.string(),
  date: z.string(),
  snippet: z.string(),
  unread: z.boolean(),
});

const gmailSearchPocOutput = z.object({
  emails: z.array(gmailSearchPocEmail).default([]),
  total: z.number().int().nonnegative().optional(),
  error: toolErrorSchema.optional(),
});

type GmailSearchPocInput = z.infer<typeof gmailSearchPocInput>;
type GmailSearchPocOutput = z.infer<typeof gmailSearchPocOutput>;

class GmailSearchPocTool extends Tool {
  readonly name = "gmail.search.poc" as const;

  readonly intent = defineIntent({
    name: "GmailSearchPoc",
    intent: "gmail.search.poc",
    description:
      "Search Gmail for candidate messages.",
    fields: {
      query: field.string("The Gmail search query to execute."),
      maxResults: field.number("Maximum messages to return, between 1 and 10."),
    },
  });

  readonly input = gmailSearchPocInput;
  readonly output = gmailSearchPocOutput;
  readonly promptFiles = ["./prompt.md"] as const;

  protected get moduleUrl(): string {
    return import.meta.url;
  }

  protected async execute(input: GmailSearchPocInput): Promise<GmailSearchPocOutput> {
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
  }

  protected override onError(error: unknown) {
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

    if (error instanceof Error && /auth|credential|token/i.test(error.message)) {
      return { error: { type: "auth_error" } };
    }

    return {
      error: {
        type: "external_error",
        message: error instanceof Error ? error.message : "Unknown Gmail error",
      },
    };
  }
}

export const gmailSearchPocTool = new GmailSearchPocTool();
export const gmailSearchPocDeclaration = gmailSearchPocTool.toToolDeclaration();

if (import.meta.main) {
  void runPromptBackedTool(gmailSearchPocTool);
}
