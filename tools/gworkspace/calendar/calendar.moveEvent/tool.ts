import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

export async function moveEvent(
  input: {
    calendarId?: string;
    eventId: string;
    destinationCalendarId: string;
    sendUpdates?: string;
  },
  opts: { client: CalendarClient },
) {
  const res = await opts.client.events.move({
    calendarId: input.calendarId ?? "primary",
    eventId: input.eventId,
    destination: input.destinationCalendarId,
    sendUpdates: (input.sendUpdates as "all" | "externalOnly" | "none") ?? "all",
  });

  const event = res.data;
  return {
    id: event.id ?? "",
    summary: event.summary ?? "",
    htmlLink: event.htmlLink ?? "",
    start: { dateTime: event.start?.dateTime ?? undefined, date: event.start?.date ?? undefined, timeZone: event.start?.timeZone ?? undefined },
    end: { dateTime: event.end?.dateTime ?? undefined, date: event.end?.date ?? undefined, timeZone: event.end?.timeZone ?? undefined },
  };
}

export const calendarMoveEventTool = defineTool({
  name: "calendar.moveEvent",
  resource: "calendar",
  capability: "update",
  description: "Move an event from one calendar to another.",
  input: z.object({
    calendarId: z.string().default("primary").describe("Source calendar ID."),
    eventId: z.string().min(1).describe("The event ID to move."),
    destinationCalendarId: z.string().min(1).describe("Target calendar ID."),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all").describe("Who receives notifications."),
  }),
  output: z.object({
    id: z.string(),
    summary: z.string(),
    htmlLink: z.string(),
    start: z.object({ dateTime: z.string().optional(), date: z.string().optional(), timeZone: z.string().optional() }),
    end: z.object({ dateTime: z.string().optional(), date: z.string().optional(), timeZone: z.string().optional() }),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return moveEvent(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarMoveEventTool);
}
