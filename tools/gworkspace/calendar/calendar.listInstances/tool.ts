import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";
import { mapEvent, eventSchema } from "../calendar.listEvents/tool.ts";

export type CalendarClient = calendar_v3.Calendar;

export async function listInstances(
  input: {
    calendarId?: string;
    eventId: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  },
  opts: { client: CalendarClient },
) {
  const res = await opts.client.events.instances({
    calendarId: input.calendarId ?? "primary",
    eventId: input.eventId,
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    maxResults: input.maxResults ?? 25,
  });

  const instances = (res.data.items ?? []).map(mapEvent);
  return { instances };
}

export const calendarListInstancesTool = defineTool({
  name: "calendar.listInstances",
  resource: "calendar",
  capability: "search",
  description: "List individual occurrences of a recurring event.",
  idempotent: true,
  input: z.object({
    calendarId: z.string().default("primary").describe("Calendar ID."),
    eventId: z.string().min(1).describe("The recurring event's base ID."),
    timeMin: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/, "Must be YYYY-MM-DDTHH:MM:SS with optional offset").optional().describe("Lower bound for instances."),
    timeMax: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/, "Must be YYYY-MM-DDTHH:MM:SS with optional offset").optional().describe("Upper bound for instances."),
    maxResults: z.number().int().min(1).max(250).default(25).describe("Maximum instances to return."),
  }),
  output: z.object({
    instances: z.array(eventSchema).default([]),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return listInstances(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarListInstancesTool);
}
