import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const diagnosticsSchema = z.object({
  campaign_id: z.string().optional(),
  last_updated: z.string().optional(),
  status: z.string().nullable().optional(),
  issue_tracking: z.unknown().optional(),
}).passthrough();

const summarySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  severity: z.string().optional(),
}).passthrough();

const inputSchema = z.object({
  campaignId: z.string().uuid(),
  withAiSummary: z.boolean().optional(),
});

const responseSchema = z.object({
  diagnostics: diagnosticsSchema.nullable(),
  summary: summarySchema.nullable(),
});

export type InstantlyCampaignSendingStatusInput = z.input<typeof inputSchema>;

export async function getInstantlyCampaignSendingStatus(
  rawInput: InstantlyCampaignSendingStatusInput,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: InstantlyFetch },
): Promise<{
  diagnostics: z.output<typeof diagnosticsSchema> | null;
  summary: z.output<typeof summarySchema> | null;
}> {
  const input = inputSchema.parse(rawInput);
  const payload = await instantlyRequest(
    {
      path: `/campaigns/${input.campaignId}/sending-status`,
      query: { with_ai_summary: input.withAiSummary },
      responseSchema,
    },
    options,
  );
  return {
    diagnostics: payload.diagnostics,
    summary: payload.summary,
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
  if (error instanceof Error && /INSTANTLY_API_KEY|auth|credential|token/i.test(error.message)) {
    return { type: "auth_error", message: error.message };
  }
  return {
    type: "external_error",
    message: error instanceof Error ? error.message : "Unknown Instantly campaign sending-status error",
  };
};

export const instantlyCampaignSendingStatusTool = defineTool({
  name: "instantly.campaign.sendingStatus",
  resource: "instantly.campaign",
  capability: "read",
  description: "Inspect an Instantly campaign sending status and optional AI summary.",
  idempotent: true,
  input: inputSchema,
  output: z.object({
    diagnostics: diagnosticsSchema.nullable(),
    summary: summarySchema.nullable(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return getInstantlyCampaignSendingStatus(input);
  },
  onError,
});

if (import.meta.main) {
  void runDeclaredTool(instantlyCampaignSendingStatusTool);
}
