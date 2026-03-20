import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { instantlyRequest, type InstantlyFetch } from "../../lib/client.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "../../lib/errors.ts";

const inputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10).describe(
    "Maximum email records to return, between 1 and 100.",
  ),
  startingAfter: z.string().min(1).optional().describe(
    "Pagination cursor from a previous response.",
  ),
  search: z.string().min(1).optional().describe(
    "Free-text search across email activity.",
  ),
  campaignId: z.string().uuid().optional().describe(
    "Filter to a single campaign ID.",
  ),
  listId: z.string().uuid().optional().describe(
    "Filter to a single list ID.",
  ),
  iStatus: z.number().optional().describe(
    "Filter by Instantly email status.",
  ),
  eaccount: z.array(z.string().email()).max(100).optional().describe(
    "Filter by sending account email address. Multiple values are allowed.",
  ),
  isUnread: z.boolean().optional().describe(
    "Filter by unread state.",
  ),
  hasReminder: z.boolean().optional().describe(
    "Filter by reminder presence.",
  ),
  mode: z.enum(["emode_focused", "emode_others", "emode_all"]).optional().describe(
    "Filter by Unibox mode.",
  ),
  previewOnly: z.boolean().optional().describe(
    "Whether to return preview payloads only.",
  ),
  sortOrder: z.enum(["asc", "desc"]).optional().describe(
    "Sort by email creation date.",
  ),
  scheduledOnly: z.boolean().optional().describe(
    "Whether to only return scheduled emails.",
  ),
  assignedTo: z.string().uuid().optional().describe(
    "Filter by assigned user ID.",
  ),
  lead: z.string().email().optional().describe(
    "Filter by lead email address.",
  ),
  companyDomain: z.string().min(1).optional().describe(
    "Filter by company domain.",
  ),
  markedAsDone: z.boolean().optional().describe(
    "Filter by done state.",
  ),
  emailType: z.enum(["received", "sent", "manual"]).optional().describe(
    "Filter by email type.",
  ),
  minTimestampCreated: z.string().min(1).optional().describe(
    "Filter emails created after this ISO timestamp.",
  ),
  maxTimestampCreated: z.string().min(1).optional().describe(
    "Filter emails created before this ISO timestamp.",
  ),
});

const emailSchema = z.object({
  id: z.string(),
  subject: z.string().nullable().optional(),
  from_address_email: z.string().email().nullable().optional(),
  lead: z.string().email().nullable().optional(),
  eaccount: z.string().email().nullable().optional(),
  campaign_id: z.string().nullable().optional(),
  thread_id: z.string().nullable().optional(),
  is_unread: z.union([z.boolean(), z.number().int()]).optional(),
  timestamp_created: z.string().optional(),
});

const responseSchema = z.object({
  items: z.array(emailSchema),
  next_starting_after: z.string().nullable().optional(),
});

const outputEmailSchema = z.object({
  id: z.string(),
  subject: z.string().nullable(),
  fromAddressEmail: z.string().nullable(),
  leadEmail: z.string().nullable(),
  eaccount: z.string().nullable(),
  campaignId: z.string().nullable(),
  threadId: z.string().nullable(),
  unread: z.boolean(),
  timestampCreated: z.string().optional(),
});

export type InstantlyEmailSearchInput = z.input<typeof inputSchema>;

export async function searchInstantlyEmails(
  rawInput: InstantlyEmailSearchInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: InstantlyFetch;
  },
): Promise<{
  emails: Array<z.output<typeof outputEmailSchema>>;
  nextStartingAfter?: string;
}> {
  const input = inputSchema.parse(rawInput);
  const payload = await instantlyRequest(
    {
      path: "/emails",
      query: {
        limit: input.limit,
        starting_after: input.startingAfter,
        search: input.search,
        campaign_id: input.campaignId,
        list_id: input.listId,
        i_status: input.iStatus,
        eaccount: input.eaccount,
        is_unread: input.isUnread,
        has_reminder: input.hasReminder,
        mode: input.mode,
        preview_only: input.previewOnly,
        sort_order: input.sortOrder,
        scheduled_only: input.scheduledOnly,
        assigned_to: input.assignedTo,
        lead: input.lead,
        company_domain: input.companyDomain,
        marked_as_done: input.markedAsDone,
        email_type: input.emailType,
        min_timestamp_created: input.minTimestampCreated,
        max_timestamp_created: input.maxTimestampCreated,
      },
      responseSchema,
    },
    options,
  );

  return {
    emails: payload.items.map((email) => ({
      id: email.id,
      subject: email.subject ?? null,
      fromAddressEmail: email.from_address_email ?? null,
      leadEmail: email.lead ?? null,
      eaccount: email.eaccount ?? null,
      campaignId: email.campaign_id ?? null,
      threadId: email.thread_id ?? null,
      unread: typeof email.is_unread === "number" ? email.is_unread !== 0 : (email.is_unread ?? false),
      ...(email.timestamp_created ? { timestampCreated: email.timestamp_created } : {}),
    })),
    nextStartingAfter: payload.next_starting_after ?? undefined,
  };
}

export const instantlyEmailSearchTool = defineTool({
  name: "instantly.email.search",
  resource: "instantly.email",
  capability: "search",
  description: "Search Instantly email activity using the API v2 emails endpoint.",
  idempotent: true,
  input: inputSchema,
  output: z.object({
    emails: z.array(outputEmailSchema).default([]),
    nextStartingAfter: z.string().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return searchInstantlyEmails(input);
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
      message: error instanceof Error ? error.message : "Unknown Instantly email search error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(instantlyEmailSearchTool);
}
