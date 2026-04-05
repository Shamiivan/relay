import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

const dateTimeInput = z.object({
  dateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/, "Must be YYYY-MM-DDTHH:MM:SS with optional offset (+HH:MM or Z). Use timeZone field instead of offset.").optional().describe("Datetime, e.g. 2026-04-05T14:00:00. Pair with timeZone instead of adding an offset."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional().describe("YYYY-MM-DD. Use for all-day events."),
  timeZone: z.string().optional().describe("IANA timezone, e.g. America/Montreal."),
});

const attendeeInput = z.object({
  email: z.string().email("Invalid attendee email address").describe("Attendee email address."),
  optional: z.boolean().optional().describe("Whether attendance is optional."),
});

const reminderOverride = z.object({
  method: z.enum(["email", "popup"]).describe("Reminder delivery method."),
  minutes: z.number().int().min(0).describe("Minutes before event to trigger reminder."),
});

export async function createEvent(
  input: {
    calendarId?: string;
    summary: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    description?: string;
    location?: string;
    attendees?: { email: string; optional?: boolean }[];
    reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
    recurrence?: string[];
    sendUpdates?: string;
  },
  opts: { client: CalendarClient },
) {
  const res = await opts.client.events.insert({
    calendarId: input.calendarId ?? "primary",
    sendUpdates: (input.sendUpdates as "all" | "externalOnly" | "none") ?? "all",
    requestBody: {
      summary: input.summary,
      start: input.start,
      end: input.end,
      description: input.description,
      location: input.location,
      attendees: input.attendees?.map((a) => ({ email: a.email, optional: a.optional })),
      reminders: input.reminders,
      recurrence: input.recurrence,
    },
  });

  const event = res.data;
  return {
    id: event.id ?? "",
    summary: event.summary ?? "",
    htmlLink: event.htmlLink ?? "",
    start: { dateTime: event.start?.dateTime ?? undefined, date: event.start?.date ?? undefined, timeZone: event.start?.timeZone ?? undefined },
    end: { dateTime: event.end?.dateTime ?? undefined, date: event.end?.date ?? undefined, timeZone: event.end?.timeZone ?? undefined },
    attendees: event.attendees?.map((a) => ({ email: a.email ?? "", responseStatus: a.responseStatus ?? undefined })),
    hangoutLink: event.hangoutLink ?? undefined,
  };
}

export const calendarCreateEventTool = defineTool({
  name: "calendar.createEvent",
  resource: "calendar",
  capability: "create",
  description: "Create a new calendar event with optional attendees, reminders, and recurrence.",
  input: z.object({
    calendarId: z.string().default("primary").describe("Calendar ID. Defaults to primary."),
    summary: z.string().min(1).describe("Event title."),
    start: dateTimeInput.describe("Event start. Use dateTime for timed events, date for all-day."),
    end: dateTimeInput.describe("Event end. Use dateTime for timed events, date for all-day."),
    description: z.string().optional().describe("Event description or notes."),
    location: z.string().optional().describe("Event location or address."),
    attendees: z.array(attendeeInput).optional().describe("People to invite. They receive email invitations by default."),
    reminders: z.object({
      useDefault: z.boolean().describe("Use the calendar's default reminders."),
      overrides: z.array(reminderOverride).optional().describe("Custom reminders. Only used when useDefault is false."),
    }).optional().describe("Reminder settings for this event."),
    recurrence: z.array(z.string()).optional().describe("RRULE strings for recurring events, e.g. [\"RRULE:FREQ=WEEKLY;COUNT=10\"]."),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all").describe("Who receives email notifications. Defaults to all."),
  }),
  output: z.object({
    id: z.string(),
    summary: z.string(),
    htmlLink: z.string(),
    start: z.object({ dateTime: z.string().optional(), date: z.string().optional(), timeZone: z.string().optional() }),
    end: z.object({ dateTime: z.string().optional(), date: z.string().optional(), timeZone: z.string().optional() }),
    attendees: z.array(z.object({ email: z.string(), responseStatus: z.string().optional() })).optional(),
    hangoutLink: z.string().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return createEvent(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarCreateEventTool);
}
