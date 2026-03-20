import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import {
  getInstantlyApiKey,
  getInstantlyBaseUrl,
  type InstantlyFetch,
} from "../../lib/client.ts";
import { InstantlyApiError } from "../../lib/errors.ts";

const inputSchema = z.object({ campaignId: z.string().uuid() });

export async function shareInstantlyCampaign(
  rawInput: z.input<typeof inputSchema>,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: InstantlyFetch },
): Promise<{ shared: true; campaignId: string }> {
  const input = inputSchema.parse(rawInput);
  const env = options?.env ?? process.env;
  const fetchImpl = options?.fetchImpl ?? (globalThis.fetch as InstantlyFetch | undefined);
  if (!fetchImpl) throw new Error("Fetch is not available in this runtime");

  const url = new URL(`campaigns/${input.campaignId}/share`, getInstantlyBaseUrl(env));
  const response = await fetchImpl(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${getInstantlyApiKey(env)}`,
    },
  });

  if (!response.ok) {
    const message = (await response.text()).trim() || `Instantly API returned HTTP ${response.status}`;
    throw new InstantlyApiError(response.status, message);
  }

  return { shared: true, campaignId: input.campaignId };
}

const onError = (error: unknown): ToolErrorInfo => {
  if (error instanceof z.ZodError) return { type: "validation", message: error.issues[0]?.message };
  if (error instanceof InstantlyApiError) {
    if (error.status === 401 || error.status === 403) return { type: "auth_error", message: error.message };
    if (error.status === 404) return { type: "not_found", message: error.message };
    if (error.status === 429) return { type: "rate_limit_error", message: error.message };
    return { type: "external_error", message: error.message };
  }
  if (error instanceof Error && /INSTANTLY_API_KEY|auth|credential|token/i.test(error.message)) {
    return { type: "auth_error", message: error.message };
  }
  return {
    type: "external_error",
    message: error instanceof Error ? error.message : "Unknown Instantly campaign share error",
  };
};

export const instantlyCampaignShareTool = defineTool({
  name: "instantly.campaign.share",
  resource: "instantly.campaign",
  capability: "update",
  description: "Share an Instantly campaign by ID.",
  input: inputSchema,
  output: z.object({ shared: z.literal(true), campaignId: z.string().uuid() }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return shareInstantlyCampaign(input);
  },
  onError,
});

if (import.meta.main) {
  void runDeclaredTool(instantlyCampaignShareTool);
}
