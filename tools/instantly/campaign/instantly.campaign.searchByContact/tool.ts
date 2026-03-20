import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { campaignResponseSchema, normalizeCampaign, normalizedCampaignSchema } from "../../lib/campaign.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const inputSchema = z.object({
  leadEmail: z.string().email(),
  limit: z.number().int().min(1).max(100).default(10),
  startingAfter: z.string().optional(),
});

const responseSchema = z.object({
  items: z.array(campaignResponseSchema),
  next_starting_after: z.string().nullable().optional(),
});

export async function searchInstantlyCampaignsByContact(
  rawInput: z.input<typeof inputSchema>,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: InstantlyFetch },
): Promise<{ campaigns: Array<z.output<typeof normalizedCampaignSchema>>; nextStartingAfter?: string }> {
  const input = inputSchema.parse(rawInput);
  const payload = await instantlyRequest({
    path: "/campaigns/search-by-contact",
    query: { lead_email: input.leadEmail, limit: input.limit, starting_after: input.startingAfter },
    responseSchema,
  }, options);
  return {
    campaigns: payload.items.map(normalizeCampaign),
    nextStartingAfter: payload.next_starting_after ?? undefined,
  };
}

const onError = (error: unknown): ToolErrorInfo => {
  if (error instanceof z.ZodError) return { type: "validation", message: error.issues[0]?.message };
  if (error instanceof InstantlyResponseParseError) return { type: "external_error", message: error.message };
  if (error instanceof InstantlyApiError) {
    if (error.status === 401 || error.status === 403) return { type: "auth_error", message: error.message };
    if (error.status === 404) return { type: "not_found", message: error.message };
    if (error.status === 429) return { type: "rate_limit_error", message: error.message };
    return { type: "external_error", message: error.message };
  }
  return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Instantly campaign search-by-contact error" };
};

export const instantlyCampaignSearchByContactTool = defineTool({
  name: "instantly.campaign.searchByContact",
  resource: "instantly.campaign",
  capability: "search",
  description: "Search Instantly campaigns by lead email address.",
  idempotent: true,
  input: inputSchema,
  output: z.object({ campaigns: z.array(normalizedCampaignSchema).default([]), nextStartingAfter: z.string().optional() }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return searchInstantlyCampaignsByContact(input);
  },
  onError,
});

if (import.meta.main) void runDeclaredTool(instantlyCampaignSearchByContactTool);
