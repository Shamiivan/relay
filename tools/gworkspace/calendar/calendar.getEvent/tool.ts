import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";
import { mapEvent, eventSchema } from "../calendar.listEvents/tool.ts";

export type CalendarClient = calendar_v3.Calendar;

const fullEventSchema = eventSchema.extend({
  creator: z.object({ email: z.string().optional(), displayName: z.string().optional() }).optional(),
  reminders: z.object({
    useDefault: z.boolean().optional(),
    overrides: z.array(z.object({ method: z.string(), minutes: z.number() })).optional(),
  }).optional(),
  recurrence: z.array(z.string()).optional(),
  hangoutLink: z.string().optional(),
});

export async function getEvent(
  input: { calendarId?: string; eventId: string },
  opts: { client: CalendarClient },
) {
  const res = await opts.client.events.get({
    calendarId: input.calendarId ?? "primary",
    eventId: input.eventId,
  });

  const event = res.data;
  return {
    ...mapEvent(event),
    creator: event.creator ? { email: event.creator.email ?? undefined, displayName: event.creator.displayName ?? undefined } : undefined,
    reminders: event.reminders ? {
      useDefault: event.reminders.useDefault ?? undefined,
      overrides: event.reminders.overrides?.map((o) => ({ method: o.method ?? "", minutes: o.minutes ?? 0 })),
    } : undefined,
    recurrence: event.recurrence ?? undefined,
    hangoutLink: event.hangoutLink ?? undefined,
  };
}

export const calendarGetEventTool = defineTool({
  name: "calendar.getEvent",
  resource: "calendar",
  capability: "read",
  description: "Get full details of a single calendar event by ID.",
  idempotent: true,
  input: z.object({
    calendarId: z.string().default("primary").describe("Calendar ID."),
    eventId: z.string().min(1).describe("The event ID to retrieve."),
  }),
  output: fullEventSchema,
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return getEvent(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarGetEventTool);
}
