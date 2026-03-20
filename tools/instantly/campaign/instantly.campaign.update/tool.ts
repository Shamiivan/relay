import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { campaignMutableFieldsSchema, campaignResponseSchema, normalizeCampaign, normalizedCampaignSchema } from "../../lib/campaign.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const inputSchema = campaignMutableFieldsSchema.extend({
  campaignId: z.string().uuid(),
}).superRefine((value, ctx) => {
  const { campaignId: _campaignId, ...body } = value;
  if (Object.keys(body).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide at least one campaign field to update",
      path: ["campaignId"],
    });
  }
});

export type InstantlyCampaignUpdateInput = z.input<typeof inputSchema>;

export async function updateInstantlyCampaign(
  rawInput: InstantlyCampaignUpdateInput,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: InstantlyFetch },
): Promise<{ campaign: z.output<typeof normalizedCampaignSchema> }> {
  const input = inputSchema.parse(rawInput);
  const { campaignId, ...body } = input;
  const payload = await instantlyRequest(
    { path: `/campaigns/${campaignId}`, method: "PATCH", body, responseSchema: campaignResponseSchema },
    options,
  );
  return { campaign: normalizeCampaign(payload) };
}

export const instantlyCampaignUpdateTool = defineTool({
  name: "instantly.campaign.update",
  resource: "instantly.campaign",
  capability: "update",
  updateMode: "patch",
  description: "Patch an existing Instantly campaign using the API v2 campaigns endpoint.",
  input: inputSchema,
  output: z.object({ campaign: normalizedCampaignSchema }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return updateInstantlyCampaign(input);
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
    return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Instantly campaign update error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(instantlyCampaignUpdateTool);
}
