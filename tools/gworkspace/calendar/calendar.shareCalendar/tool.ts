import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

export async function shareCalendar(
  input: {
    calendarId: string;
    email: string;
    role: "reader" | "writer" | "owner" | "freeBusyReader";
    sendNotifications?: boolean;
  },
  opts: { client: CalendarClient },
) {
  const res = await opts.client.acl.insert({
    calendarId: input.calendarId,
    sendNotifications: input.sendNotifications ?? true,
    requestBody: {
      role: input.role,
      scope: { type: "user", value: input.email },
    },
  });

  const rule = res.data;
  return {
    id: rule.id ?? "",
    role: rule.role ?? "",
    scope: {
      type: rule.scope?.type ?? "",
      value: rule.scope?.value ?? "",
    },
  };
}

export const calendarShareCalendarTool = defineTool({
  name: "calendar.shareCalendar",
  resource: "calendar",
  capability: "create",
  description: "Share a calendar with another user by granting them an access role.",
  input: z.object({
    calendarId: z.string().min(1).describe("Calendar ID to share."),
    email: z.string().min(1).describe("Email address of the person to share with."),
    role: z.enum(["reader", "writer", "owner", "freeBusyReader"]).describe(
      "Access level: reader (see events), writer (edit events), owner (full control), freeBusyReader (only see free/busy).",
    ),
    sendNotifications: z.boolean().default(true).describe("Send an email notification to the person."),
  }),
  output: z.object({
    id: z.string(),
    role: z.string(),
    scope: z.object({ type: z.string(), value: z.string() }),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return shareCalendar(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarShareCalendarTool);
}
