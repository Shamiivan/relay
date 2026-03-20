import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const inputSchema = z.object({});
const responseSchema = z.object({ count: z.number().int().nonnegative() }).passthrough();

export async function getInstantlyCampaignCountLaunched(
  _rawInput: z.input<typeof inputSchema>,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: InstantlyFetch },
): Promise<{ count: number }> {
  const payload = await instantlyRequest({ path: "/campaigns/count-launched", responseSchema }, options);
  return { count: payload.count };
}

const onError = (error: unknown): ToolErrorInfo => {
  if (error instanceof InstantlyResponseParseError) return { type: "external_error", message: error.message };
  if (error instanceof InstantlyApiError) {
    if (error.status === 401 || error.status === 403) return { type: "auth_error", message: error.message };
    if (error.status === 429) return { type: "rate_limit_error", message: error.message };
    return { type: "external_error", message: error.message };
  }
  return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Instantly campaign count-launched error" };
};

export const instantlyCampaignCountLaunchedTool = defineTool({
  name: "instantly.campaign.countLaunched",
  resource: "instantly.campaign",
  capability: "read",
  idempotent: true,
  description: "Get the count of launched Instantly campaigns.",
  input: inputSchema,
  output: z.object({ count: z.number().int().nonnegative() }),
  prompt: promptFile("./prompt.md"),
  async handler() { return getInstantlyCampaignCountLaunched({}); },
  onError,
});

if (import.meta.main) void runDeclaredTool(instantlyCampaignCountLaunchedTool);
