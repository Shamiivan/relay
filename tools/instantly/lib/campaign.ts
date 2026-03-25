import { z } from "zod";

// Source: Instantly official Campaign schema docs (2026-03-23).
const instantlyCampaignScheduleTimezones = new Set([
  "Etc/GMT+12",
  "Etc/GMT+11",
  "Etc/GMT+10",
  "America/Anchorage",
  "America/Dawson",
  "America/Creston",
  "America/Chihuahua",
  "America/Boise",
  "America/Belize",
  "America/Chicago",
  "America/Bahia_Banderas",
  "America/Regina",
  "America/Bogota",
  "America/Detroit",
  "America/Indiana/Marengo",
  "America/Caracas",
  "America/Asuncion",
  "America/Glace_Bay",
  "America/Campo_Grande",
  "America/Anguilla",
  "America/Santiago",
  "America/St_Johns",
  "America/Sao_Paulo",
  "America/Argentina/La_Rioja",
  "America/Araguaina",
  "America/Godthab",
  "America/Montevideo",
  "America/Bahia",
  "America/Noronha",
  "America/Scoresbysund",
  "Atlantic/Cape_Verde",
  "Africa/Casablanca",
  "America/Danmarkshavn",
  "Europe/Isle_of_Man",
  "Atlantic/Canary",
  "Africa/Abidjan",
  "Arctic/Longyearbyen",
  "Europe/Belgrade",
  "Africa/Ceuta",
  "Europe/Sarajevo",
  "Africa/Algiers",
  "Africa/Windhoek",
  "Asia/Nicosia",
  "Asia/Beirut",
  "Africa/Cairo",
  "Asia/Damascus",
  "Europe/Bucharest",
  "Africa/Blantyre",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Asia/Jerusalem",
  "Africa/Tripoli",
  "Asia/Amman",
  "Asia/Baghdad",
  "Europe/Kaliningrad",
  "Asia/Aden",
  "Africa/Addis_Ababa",
  "Europe/Kirov",
  "Europe/Astrakhan",
  "Asia/Tehran",
  "Asia/Dubai",
  "Asia/Baku",
  "Indian/Mahe",
  "Asia/Tbilisi",
  "Asia/Yerevan",
  "Asia/Kabul",
  "Antarctica/Mawson",
  "Asia/Yekaterinburg",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Kathmandu",
  "Antarctica/Vostok",
  "Asia/Dhaka",
  "Asia/Rangoon",
  "Antarctica/Davis",
  "Asia/Novokuznetsk",
  "Asia/Hong_Kong",
  "Asia/Krasnoyarsk",
  "Asia/Brunei",
  "Australia/Perth",
  "Asia/Taipei",
  "Asia/Choibalsan",
  "Asia/Irkutsk",
  "Asia/Dili",
  "Asia/Pyongyang",
  "Australia/Adelaide",
  "Australia/Darwin",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Antarctica/DumontDUrville",
  "Australia/Currie",
  "Asia/Chita",
  "Antarctica/Macquarie",
  "Asia/Sakhalin",
  "Pacific/Auckland",
  "Etc/GMT-12",
  "Pacific/Fiji",
  "Asia/Anadyr",
  "Asia/Kamchatka",
  "Etc/GMT-13",
  "Pacific/Apia",
]);

const timezoneSchema = z.string().trim().min(1).refine(
  (value) => instantlyCampaignScheduleTimezones.has(value),
  "Use an Instantly-supported campaign timezone value.",
);

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
  timezone: timezoneSchema.optional(),
  timing: timingSchema,
  days: scheduleDaySchema,
}).passthrough();

export const campaignScheduleSchema = z.object({
  schedules: z.array(campaignScheduleItemSchema).min(1),
  timezone: timezoneSchema.optional(),
  start_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
}).passthrough().superRefine((value, ctx) => {
  value.schedules.forEach((schedule, index) => {
    if (!schedule.timezone && !value.timezone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each campaign schedule entry needs a timezone.",
        path: ["schedules", index, "timezone"],
      });
    }
  });
}).transform(({ timezone, schedules, ...rest }) => ({
  ...rest,
  ...(timezone ? { timezone } : {}),
  schedules: schedules.map((schedule) => ({
    ...schedule,
    timezone: schedule.timezone ?? timezone!,
  })),
}));

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
