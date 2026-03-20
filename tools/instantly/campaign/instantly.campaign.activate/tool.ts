import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { campaignResponseSchema, normalizeCampaign, normalizedCampaignSchema } from "../../lib/campaign.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const inputSchema = z.object({ campaignId: z.string().uuid() });

export async function activateInstantlyCampaign(
  rawInput: z.input<typeof inputSchema>,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: InstantlyFetch },
): Promise<{ campaign: z.output<typeof normalizedCampaignSchema> }> {
  const input = inputSchema.parse(rawInput);
  const payload = await instantlyRequest(
    { path: `/campaigns/${input.campaignId}/activate`, method: "POST", responseSchema: campaignResponseSchema },
    options,
  );
  return { campaign: normalizeCampaign(payload) };
}

export const instantlyCampaignActivateTool = defineTool({
  name: "instantly.campaign.activate",
  resource: "instantly.campaign",
  capability: "update",
  description: "Activate or resume an Instantly campaign.",
  input: inputSchema,
  output: z.object({ campaign: normalizedCampaignSchema }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return activateInstantlyCampaign(input);
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
    return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Instantly campaign activate error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(instantlyCampaignActivateTool);
}
