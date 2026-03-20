import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { campaignResponseSchema, normalizeCampaign, normalizedCampaignSchema } from "../../lib/campaign.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const inputSchema = z.object({ campaignId: z.string().uuid() });

export async function pauseInstantlyCampaign(
  rawInput: z.input<typeof inputSchema>,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: InstantlyFetch },
): Promise<{ campaign: z.output<typeof normalizedCampaignSchema> }> {
  const input = inputSchema.parse(rawInput);
  const payload = await instantlyRequest(
    { path: `/campaigns/${input.campaignId}/pause`, method: "POST", responseSchema: campaignResponseSchema },
    options,
  );
  return { campaign: normalizeCampaign(payload) };
}

export const instantlyCampaignPauseTool = defineTool({
  name: "instantly.campaign.pause",
  resource: "instantly.campaign",
  capability: "update",
  description: "Pause an Instantly campaign.",
  input: inputSchema,
  output: z.object({ campaign: normalizedCampaignSchema }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return pauseInstantlyCampaign(input);
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) return { type: "validation", message: error.issues[0]?.message };
    if (error instanceof InstantlyResponseParseError) return { type: "external_error", message: error.message };
    if (error instanceof InstantlyApiError) {
      if (error.status === 401 || error.status === 403) return { type: "auth_error", message: error.message };
      if (error.status === 404) return { type: "not_found", message: error.message };
      if (error.status === 429) return { type: "rate_limit_error", message: error.message };
      return { type: "external_error", message: error.message };
    }
    if (error instanceof Error && /INSTANTLY_API_KEY|auth|credential|token/i.test(error.message)) {
      return { type: "auth_error", message: error.message };
    }
    return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Instantly campaign pause error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(instantlyCampaignPauseTool);
}
