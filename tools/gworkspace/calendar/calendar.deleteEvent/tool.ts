import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

export async function deleteEvent(
  input: { calendarId?: string; eventId: string; sendUpdates?: string },
  opts: { client: CalendarClient },
) {
  await opts.client.events.delete({
    calendarId: input.calendarId ?? "primary",
    eventId: input.eventId,
    sendUpdates: (input.sendUpdates as "all" | "externalOnly" | "none") ?? "all",
  });

  return { deleted: true as const, eventId: input.eventId };
}

export const calendarDeleteEventTool = defineTool({
  name: "calendar.deleteEvent",
  resource: "calendar",
  capability: "delete",
  description: "Delete a calendar event by ID.",
  destructive: true,
  input: z.object({
    calendarId: z.string().default("primary").describe("Calendar ID."),
    eventId: z.string().min(1).describe("The event ID to delete."),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).default("all").describe("Who receives cancellation notifications."),
  }),
  output: z.object({
    deleted: z.literal(true),
    eventId: z.string(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return deleteEvent(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarDeleteEventTool);
}
