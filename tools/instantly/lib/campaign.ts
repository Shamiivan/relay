import { z } from "zod";

const timingSchema = z.object({
  from: z.string().regex(/^([01][0-9]|2[0-3]):([0-5][0-9])$/),
  to: z.string().regex(/^([01][0-9]|2[0-3]):([0-5][0-9])$/),
});

const scheduleDaySchema = z.object({
  0: z.boolean().optional(),
  1: z.boolean().optional(),
  2: z.boolean().optional(),
  3: z.boolean().optional(),
  4: z.boolean().optional(),
  5: z.boolean().optional(),
  6: z.boolean().optional(),
}).partial().passthrough();

const campaignScheduleItemSchema = z.object({
  name: z.string().min(1),
  timing: timingSchema,
  days: scheduleDaySchema,
}).passthrough();

export const campaignScheduleSchema = z.object({
  schedules: z.array(campaignScheduleItemSchema).min(1),
  timezone: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
}).passthrough();

export const campaignMutableFieldsSchema = z.object({
  name: z.string().min(1).optional(),
  pl_value: z.number().nullable().optional(),
  is_evergreen: z.boolean().nullable().optional(),
  campaign_schedule: campaignScheduleSchema.optional(),
  sequences: z.array(z.unknown()).optional(),
  email_gap: z.number().nullable().optional(),
  random_wait_max: z.number().nullable().optional(),
  text_only: z.boolean().nullable().optional(),
  first_email_text_only: z.boolean().nullable().optional(),
  email_list: z.array(z.string().email()).optional(),
  daily_limit: z.number().nullable().optional(),
  stop_on_reply: z.boolean().nullable().optional(),
  email_tag_list: z.array(z.string().uuid()).optional(),
  link_tracking: z.boolean().nullable().optional(),
  open_tracking: z.boolean().nullable().optional(),
  stop_on_auto_reply: z.boolean().nullable().optional(),
  daily_max_leads: z.number().nullable().optional(),
  prioritize_new_leads: z.boolean().nullable().optional(),
  auto_variant_select: z.unknown().nullable().optional(),
  match_lead_esp: z.boolean().nullable().optional(),
  stop_for_company: z.boolean().nullable().optional(),
  insert_unsubscribe_header: z.boolean().nullable().optional(),
  allow_risky_contacts: z.boolean().nullable().optional(),
  disable_bounce_protect: z.boolean().nullable().optional(),
  limit_emails_per_company_override: z.unknown().nullable().optional(),
  cc_list: z.array(z.string().email()).optional(),
  bcc_list: z.array(z.string().email()).optional(),
  owned_by: z.string().uuid().nullable().optional(),
  ai_sdr_id: z.string().uuid().nullable().optional(),
  provider_routing_rules: z.array(z.unknown()).optional(),
}).passthrough();

export const campaignCreateBodySchema = campaignMutableFieldsSchema.extend({
  name: z.string().min(1),
  campaign_schedule: campaignScheduleSchema,
});

export const campaignResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.number().int().nullable().optional(),
  timestamp_created: z.string().optional(),
  timestamp_updated: z.string().optional(),
}).passthrough();

export const normalizedCampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.number().int().nullable(),
  timestampCreated: z.string().optional(),
  timestampUpdated: z.string().optional(),
});

export function normalizeCampaign(
  campaign: z.output<typeof campaignResponseSchema>,
): z.output<typeof normalizedCampaignSchema> {
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status ?? null,
    ...(campaign.timestamp_created ? { timestampCreated: campaign.timestamp_created } : {}),
    ...(campaign.timestamp_updated ? { timestampUpdated: campaign.timestamp_updated } : {}),
  };
}
