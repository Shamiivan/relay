import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const inputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10).describe(
    "Maximum campaigns to return, between 1 and 100.",
  ),
  startingAfter: z.string().min(1).optional().describe(
    "Pagination cursor from a previous response.",
  ),
  search: z.string().min(1).optional().describe(
    "Search by campaign name.",
  ),
  tagIds: z.array(z.string().min(1)).max(20).optional().describe(
    "Filter by one or more Instantly tag IDs.",
  ),
  aiSdrId: z.string().uuid().optional().describe(
    "Filter by AI SDR ID.",
  ),
  status: z.union([
    z.literal(-99),
    z.literal(-2),
    z.literal(-1),
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]).optional().describe(
    "Filter by campaign status. Valid values: -99, -2, -1, 0, 1, 2, 3, 4.",
  ),
});

const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.number().int().nullable().optional(),
  timestamp_created: z.string().optional(),
  timestamp_updated: z.string().optional(),
});

const responseSchema = z.object({
  items: z.array(campaignSchema),
  next_starting_after: z.string().nullable().optional(),
});

const outputCampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.number().int().nullable(),
  timestampCreated: z.string().optional(),
  timestampUpdated: z.string().optional(),
});

export type InstantlyCampaignSearchInput = z.input<typeof inputSchema>;

export async function searchInstantlyCampaigns(
  rawInput: InstantlyCampaignSearchInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: InstantlyFetch;
  },
): Promise<{
  campaigns: Array<z.output<typeof outputCampaignSchema>>;
  nextStartingAfter?: string;
}> {
  const input = inputSchema.parse(rawInput);
  const payload = await instantlyRequest(
    {
      path: "/campaigns",
      query: {
        limit: input.limit,
        starting_after: input.startingAfter,
        search: input.search,
        tag_ids: input.tagIds,
        ai_sdr_id: input.aiSdrId,
        status: input.status,
      },
      responseSchema,
    },
    options,
  );

  return {
    campaigns: payload.items.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status ?? null,
      ...(campaign.timestamp_created ? { timestampCreated: campaign.timestamp_created } : {}),
      ...(campaign.timestamp_updated ? { timestampUpdated: campaign.timestamp_updated } : {}),
    })),
    nextStartingAfter: payload.next_starting_after ?? undefined,
  };
}

export const instantlyCampaignSearchTool = defineTool({
  name: "instantly.campaign.search",
  resource: "instantly.campaign",
  capability: "search",
  description: "Search and list Instantly campaigns using the API v2 campaigns endpoint.",
  idempotent: true,
  input: inputSchema,
  output: z.object({
    campaigns: z.array(outputCampaignSchema).default([]),
    nextStartingAfter: z.string().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return searchInstantlyCampaigns(input);
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
      message: error instanceof Error ? error.message : "Unknown Instantly campaign search error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(instantlyCampaignSearchTool);
}
