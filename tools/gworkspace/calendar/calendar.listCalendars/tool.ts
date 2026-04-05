import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

const calendarEntrySchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  primary: z.boolean().optional(),
  accessRole: z.string(),
  timeZone: z.string().optional(),
});

export async function listCalendars(
  input: { maxResults?: number },
  opts: { client: CalendarClient },
) {
  const calendars: z.input<typeof calendarEntrySchema>[] = [];
  let pageToken: string | undefined;

  do {
    const res = await opts.client.calendarList.list({
      maxResults: Math.min(input.maxResults ?? 50, 250),
      pageToken,
    });

    for (const item of res.data.items ?? []) {
      calendars.push({
        id: item.id ?? "",
        summary: item.summary ?? "",
        description: item.description ?? undefined,
        primary: item.primary ?? undefined,
        accessRole: item.accessRole ?? "",
        timeZone: item.timeZone ?? undefined,
      });
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && calendars.length < (input.maxResults ?? 50));

  return { calendars: calendars.slice(0, input.maxResults ?? 50) };
}

export const calendarListCalendarsTool = defineTool({
  name: "calendar.listCalendars",
  resource: "calendar",
  capability: "search",
  description: "List the calendars visible to the authenticated user.",
  idempotent: true,
  input: z.object({
    maxResults: z.number().int().min(1).max(250).default(50).describe(
      "Maximum number of calendars to return.",
    ),
  }),
  output: z.object({
    calendars: z.array(calendarEntrySchema).default([]),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return listCalendars(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarListCalendarsTool);
}
