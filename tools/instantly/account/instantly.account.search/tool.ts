import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const inputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10).describe(
    "Maximum accounts to return, between 1 and 100.",
  ),
  startingAfter: z.string().min(1).optional().describe(
    "Pagination cursor from a previous response.",
  ),
  search: z.string().min(1).optional().describe(
    "Search by account email address.",
  ),
  status: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(-1),
    z.literal(-2),
    z.literal(-3),
  ]).optional().describe(
    "Filter by Instantly account status code.",
  ),
  providerCode: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(8),
  ]).optional().describe(
    "Filter by provider code.",
  ),
  tagIds: z.array(z.string().min(1)).max(50).optional().describe(
    "Filter accounts by any of these Instantly tag IDs.",
  ),
});

const accountSchema = z.object({
  email: z.string().email(),
  status: z.number().int().nullable().optional(),
  provider_code: z.number().int().nullable().optional(),
  warmup_status: z.number().int().nullable().optional(),
  timestamp_created: z.string().optional(),
  timestamp_updated: z.string().optional(),
});

const responseSchema = z.object({
  items: z.array(accountSchema),
  next_starting_after: z.string().nullable().optional(),
});

const outputAccountSchema = z.object({
  email: z.string(),
  status: z.number().int().nullable(),
  providerCode: z.number().int().nullable(),
  warmupStatus: z.number().int().nullable(),
  timestampCreated: z.string().optional(),
  timestampUpdated: z.string().optional(),
});

export type InstantlyAccountSearchInput = z.input<typeof inputSchema>;

export async function searchInstantlyAccounts(
  rawInput: InstantlyAccountSearchInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: InstantlyFetch;
  },
): Promise<{
  accounts: Array<z.output<typeof outputAccountSchema>>;
  nextStartingAfter?: string;
}> {
  const input = inputSchema.parse(rawInput);
  const payload = await instantlyRequest(
    {
      path: "/accounts",
      query: {
        limit: input.limit,
        starting_after: input.startingAfter,
        search: input.search,
        status: input.status,
        provider_code: input.providerCode,
        tag_ids: input.tagIds,
      },
      responseSchema,
    },
    options,
  );

  return {
    accounts: payload.items.map((account) => ({
      email: account.email,
      status: account.status ?? null,
      providerCode: account.provider_code ?? null,
      warmupStatus: account.warmup_status ?? null,
      ...(account.timestamp_created ? { timestampCreated: account.timestamp_created } : {}),
      ...(account.timestamp_updated ? { timestampUpdated: account.timestamp_updated } : {}),
    })),
    nextStartingAfter: payload.next_starting_after ?? undefined,
  };
}

export const instantlyAccountSearchTool = defineTool({
  name: "instantly.account.search",
  resource: "instantly.account",
  capability: "search",
  description: "Search and list Instantly sending accounts using the API v2 accounts endpoint.",
  idempotent: true,
  input: inputSchema,
  output: z.object({
    accounts: z.array(outputAccountSchema).default([]),
    nextStartingAfter: z.string().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return searchInstantlyAccounts(input);
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof InstantlyResponseParseError) {
      return { type: "external_error", message: error.message };
    }
    if (error instanceof InstantlyApiError) {
      if (error.status === 401 || error.status === 403) {
        return { type: "auth_error", message: error.message };
      }
      if (error.status === 404) {
        return { type: "not_found", message: error.message };
      }
      if (error.status === 429) {
        return { type: "rate_limit_error", message: error.message };
      }
      return { type: "external_error", message: error.message };
    }
    if (error instanceof Error && /INSTANTLY_API_KEY|auth|credential|token/i.test(error.message)) {
      return { type: "auth_error", message: error.message };
    }
    return {
      type: "external_error",
      message: error instanceof Error ? error.message : "Unknown Instantly account search error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(instantlyAccountSearchTool);
}
