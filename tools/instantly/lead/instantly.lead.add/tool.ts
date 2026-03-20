import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const leadInputSchema = z.object({
  email: z.string().email(),
  personalization: z.string().min(1).optional(),
  website: z.string().url().optional(),
  lastName: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  ltInterestStatus: z.number().int().optional(),
  plValueLead: z.number().int().optional(),
  assignedTo: z.string().uuid().optional(),
  customVariables: z.record(z.string(), z.string()).optional(),
});

const inputSchema = z.object({
  campaignId: z.string().uuid().optional().describe(
    "Campaign ID to add the leads to.",
  ),
  listId: z.string().uuid().optional().describe(
    "List ID to add the leads to.",
  ),
  blocklistId: z.string().uuid().optional().describe(
    "Blocklist ID to use for deduplication checks.",
  ),
  assignedTo: z.string().uuid().optional().describe(
    "Default assignee for imported leads.",
  ),
  verifyLeadsOnImport: z.boolean().optional().describe(
    "Whether Instantly should verify leads on import.",
  ),
  skipIfInWorkspace: z.boolean().optional().describe(
    "Skip leads already present in the workspace.",
  ),
  skipIfInCampaign: z.boolean().optional().describe(
    "Skip leads already present in the campaign.",
  ),
  skipIfInList: z.boolean().optional().describe(
    "Skip leads already present in the list.",
  ),
  leads: z.array(leadInputSchema).min(1).max(100).describe(
    "Leads to create inside Instantly.",
  ),
}).superRefine((value, ctx) => {
  if ((value.campaignId ? 1 : 0) + (value.listId ? 1 : 0) !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide exactly one of campaignId or listId",
      path: ["campaignId"],
    });
  }
});

const createdLeadSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});

const responseSchema = z.object({
  status: z.string().optional(),
  leads_count: z.number().int().nonnegative().optional(),
  invalid_emails_count: z.number().int().nonnegative().optional(),
  duplicate_emails_count: z.number().int().nonnegative().optional(),
  leads: z.array(createdLeadSchema).optional(),
});

const outputCreatedLeadSchema = z.object({
  id: z.string(),
  email: z.string(),
});

export type InstantlyLeadAddInput = z.input<typeof inputSchema>;

export async function addInstantlyLeads(
  rawInput: InstantlyLeadAddInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: InstantlyFetch;
  },
): Promise<{
  status: string;
  leadsCount: number;
  invalidEmailsCount: number;
  duplicateEmailsCount: number;
  leads: Array<z.output<typeof outputCreatedLeadSchema>>;
}> {
  const input = inputSchema.parse(rawInput);
  const payload = await instantlyRequest(
    {
      path: "/leads/add",
      method: "POST",
      body: {
        ...(input.campaignId ? { campaign_id: input.campaignId } : {}),
        ...(input.listId ? { list_id: input.listId } : {}),
        ...(input.blocklistId ? { blocklist_id: input.blocklistId } : {}),
        ...(input.assignedTo ? { assigned_to: input.assignedTo } : {}),
        ...(input.verifyLeadsOnImport !== undefined ? { verify_leads_on_import: input.verifyLeadsOnImport } : {}),
        ...(input.skipIfInWorkspace !== undefined ? { skip_if_in_workspace: input.skipIfInWorkspace } : {}),
        ...(input.skipIfInCampaign !== undefined ? { skip_if_in_campaign: input.skipIfInCampaign } : {}),
        ...(input.skipIfInList !== undefined ? { skip_if_in_list: input.skipIfInList } : {}),
        leads: input.leads.map((lead) => ({
          email: lead.email,
          ...(lead.personalization ? { personalization: lead.personalization } : {}),
          ...(lead.website ? { website: lead.website } : {}),
          ...(lead.lastName ? { last_name: lead.lastName } : {}),
          ...(lead.firstName ? { first_name: lead.firstName } : {}),
          ...(lead.companyName ? { company_name: lead.companyName } : {}),
          ...(lead.phone ? { phone: lead.phone } : {}),
          ...(lead.ltInterestStatus !== undefined ? { lt_interest_status: lead.ltInterestStatus } : {}),
          ...(lead.plValueLead !== undefined ? { pl_value_lead: lead.plValueLead } : {}),
          ...(lead.assignedTo ? { assigned_to: lead.assignedTo } : {}),
          ...(lead.customVariables ? { custom_variables: lead.customVariables } : {}),
        })),
      },
      responseSchema,
    },
    options,
  );

  return {
    status: payload.status ?? "ok",
    leadsCount: payload.leads_count ?? payload.leads?.length ?? input.leads.length,
    invalidEmailsCount: payload.invalid_emails_count ?? 0,
    duplicateEmailsCount: payload.duplicate_emails_count ?? 0,
    leads: (payload.leads ?? []).map((lead) => ({
      id: lead.id,
      email: lead.email,
    })),
  };
}

export const instantlyLeadAddTool = defineTool({
  name: "instantly.lead.add",
  resource: "instantly.lead",
  capability: "create",
  description: "Add leads to an Instantly campaign or list using the API v2 bulk lead import endpoint.",
  idempotent: false,
  input: inputSchema,
  output: z.object({
    status: z.string(),
    leadsCount: z.number().int().nonnegative(),
    invalidEmailsCount: z.number().int().nonnegative(),
    duplicateEmailsCount: z.number().int().nonnegative(),
    leads: z.array(outputCreatedLeadSchema).default([]),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return addInstantlyLeads(input);
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
      message: error instanceof Error ? error.message : "Unknown Instantly lead add error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(instantlyLeadAddTool);
}
