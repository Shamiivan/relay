import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

const attendeeSchema = z.object({
  email: z.string(),
  displayName: z.string().optional(),
  responseStatus: z.string().optional(),
  organizer: z.boolean().optional(),
  self: z.boolean().optional(),
});

const eventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  start: z.object({ dateTime: z.string().optional(), date: z.string().optional(), timeZone: z.string().optional() }),
  end: z.object({ dateTime: z.string().optional(), date: z.string().optional(), timeZone: z.string().optional() }),
  location: z.string().optional(),
  description: z.string().optional(),
  attendees: z.array(attendeeSchema).optional(),
  htmlLink: z.string().optional(),
  status: z.string().optional(),
  organizer: z.object({ email: z.string().optional(), displayName: z.string().optional() }).optional(),
});

function mapEvent(item: calendar_v3.Schema$Event): z.input<typeof eventSchema> {
  return {
    id: item.id ?? "",
    summary: item.summary ?? undefined,
    start: { dateTime: item.start?.dateTime ?? undefined, date: item.start?.date ?? undefined, timeZone: item.start?.timeZone ?? undefined },
    end: { dateTime: item.end?.dateTime ?? undefined, date: item.end?.date ?? undefined, timeZone: item.end?.timeZone ?? undefined },
    location: item.location ?? undefined,
    description: item.description ?? undefined,
    attendees: item.attendees?.map((a) => ({
      email: a.email ?? "",
      displayName: a.displayName ?? undefined,
      responseStatus: a.responseStatus ?? undefined,
      organizer: a.organizer ?? undefined,
      self: a.self ?? undefined,
    })),
    htmlLink: item.htmlLink ?? undefined,
    status: item.status ?? undefined,
    organizer: item.organizer ? { email: item.organizer.email ?? undefined, displayName: item.organizer.displayName ?? undefined } : undefined,
  };
}

export { mapEvent, eventSchema, attendeeSchema };

export async function listEvents(
  input: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    query?: string;
    maxResults?: number;
    singleEvents?: boolean;
    orderBy?: "startTime" | "updated";
  },
  opts: { client: CalendarClient },
) {
  const singleEvents = input.singleEvents ?? true;
  const res = await opts.client.events.list({
    calendarId: input.calendarId ?? "primary",
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    q: input.query,
    maxResults: input.maxResults ?? 10,
    singleEvents,
    orderBy: singleEvents ? (input.orderBy ?? "startTime") : input.orderBy,
  });

  const events = (res.data.items ?? []).map(mapEvent);
  return { events };
}

export const calendarListEventsTool = defineTool({
  name: "calendar.listEvents",
  resource: "calendar",
  capability: "search",
  description: "List events from a calendar with optional date range and text filters.",
  idempotent: true,
  input: z.object({
    calendarId: z.string().default("primary").describe("Calendar ID. Defaults to the user's primary calendar."),
    timeMin: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/, "Must be YYYY-MM-DDTHH:MM:SS with optional offset").optional().describe("Lower bound (inclusive) for event start. e.g. 2026-04-05T00:00:00Z"),
    timeMax: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/, "Must be YYYY-MM-DDTHH:MM:SS with optional offset").optional().describe("Upper bound (exclusive) for event start."),
    query: z.string().optional().describe("Free-text search across event fields."),
    maxResults: z.number().int().min(1).max(250).default(10).describe("Maximum events to return."),
    singleEvents: z.boolean().default(true).describe("Expand recurring events into individual instances. Defaults to true."),
    orderBy: z.enum(["startTime", "updated"]).optional().describe("Sort order. Only valid when singleEvents is true."),
  }),
  output: z.object({
    events: z.array(eventSchema).default([]),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return listEvents(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarListEventsTool);
}
