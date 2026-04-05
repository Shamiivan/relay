import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

export async function queryFreebusy(
  input: {
    timeMin: string;
    timeMax: string;
    items: { id: string }[];
    timeZone?: string;
  },
  opts: { client: CalendarClient },
) {
  const res = await opts.client.freebusy.query({
    requestBody: {
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      timeZone: input.timeZone,
      items: input.items,
    },
  });

  const calendars: Record<string, { busy: { start: string; end: string }[] }> = {};
  for (const [id, data] of Object.entries(res.data.calendars ?? {})) {
    calendars[id] = {
      busy: (data.busy ?? []).map((b) => ({
        start: b.start ?? "",
        end: b.end ?? "",
      })),
    };
  }

  return { calendars };
}

export const calendarFreebusyTool = defineTool({
  name: "calendar.freebusy",
  resource: "calendar",
  capability: "read",
  description: "Check availability (free/busy times) for one or more calendars in a given time range.",
  idempotent: true,
  input: z.object({
    timeMin: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/, "Must be YYYY-MM-DDTHH:MM:SS with optional offset").describe("Start of the time range."),
    timeMax: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/, "Must be YYYY-MM-DDTHH:MM:SS with optional offset").describe("End of the time range."),
    items: z.array(z.object({
      id: z.string().describe("Calendar ID to check. Use 'primary' for the user's main calendar."),
    })).min(1).describe("Calendars to check availability for."),
    timeZone: z.string().optional().describe("IANA timezone for interpreting results."),
  }),
  output: z.object({
    calendars: z.record(z.string(), z.object({
      busy: z.array(z.object({ start: z.string(), end: z.string() })),
    })),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return queryFreebusy(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarFreebusyTool);
}
