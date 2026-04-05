import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

const dateTimeInput = z.object({
  dateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/, "Must be YYYY-MM-DDTHH:MM:SS with optional offset").optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  timeZone: z.string().optional(),
});

const attendeeInput = z.object({
  email: z.string().email("Invalid attendee email address"),
  optional: z.boolean().optional(),
});

const reminderOverride = z.object({
  method: z.enum(["email", "popup"]),
  minutes: z.number().int().min(0),
});

export async function patchEvent(
  input: {
    calendarId?: string;
    eventId: string;
    summary?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    description?: string;
    location?: string;
    attendees?: { email: string; optional?: boolean }[];
    reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] };
    sendUpdates?: string;
  },
  opts: { client: CalendarClient },
) {
  const body: calendar_v3.Schema$Event = {};
  if (input.summary !== undefined) body.summary = input.summary;
  if (input.start !== undefined) body.start = input.start;
  if (input.end !== undefined) body.end = input.end;
  if (input.description !== undefined) body.description = input.description;
  if (input.location !== undefined) body.location = input.location;
  if (input.attendees !== undefined) {
    body.attendees = input.attendees.map((a) => ({ email: a.email, optional: a.optional }));
  }
  if (input.reminders !== undefined) body.reminders = input.reminders;

  const res = await opts.client.events.patch({
    calendarId: input.calendarId ?? "primary",
    eventId: input.eventId,
    sendUpdates: (input.sendUpdates as "all" | "externalOnly" | "none") ?? "all",
    requestBody: body,
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

export const calendarPatchEventTool = defineTool({
  name: "calendar.patchEvent",
  resource: "calendar",
  capability: "update",
  description: "Update specific fields of an existing calendar event. Only provided fields are changed.",
  updateMode: "patch",
  input: z.object({
    calendarId: z.string().default("primary").describe("Calendar ID."),
    eventId: z.string().min(1).describe("The event ID to update."),
    summary: z.string().optional().describe("New event title."),
    start: dateTimeInput.optional().describe("New start time."),
    end: dateTimeInput.optional().describe("New end time."),
    description: z.string().optional().describe("New description."),
    location: z.string().optional().describe("New location."),
    attendees: z.array(attendeeInput).optional().describe("Full replacement attendee list. To add someone, include all existing attendees plus the new one."),
    reminders: z.object({
      useDefault: z.boolean(),
      overrides: z.array(reminderOverride).optional(),
    }).optional().describe("Replacement reminder settings."),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all").describe("Who receives email notifications."),
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
    return patchEvent(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarPatchEventTool);
}
