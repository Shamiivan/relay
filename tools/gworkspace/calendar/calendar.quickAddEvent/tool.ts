import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

export async function quickAddEvent(
  input: { calendarId?: string; text: string; sendUpdates?: string },
  opts: { client: CalendarClient },
) {
  const res = await opts.client.events.quickAdd({
    calendarId: input.calendarId ?? "primary",
    text: input.text,
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

export const calendarQuickAddEventTool = defineTool({
  name: "calendar.quickAddEvent",
  resource: "calendar",
  capability: "create",
  description: "Create an event from a natural language text string. Google parses the time, date, and title automatically.",
  input: z.object({
    calendarId: z.string().default("primary").describe("Calendar ID."),
    text: z.string().min(1).describe("Natural language event description, e.g. 'Lunch with Alice tomorrow at noon'."),
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
    return quickAddEvent(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarQuickAddEventTool);
}
