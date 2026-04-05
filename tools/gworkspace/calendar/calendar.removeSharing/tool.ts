import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

export async function removeSharing(
  input: { calendarId: string; ruleId: string },
  opts: { client: CalendarClient },
) {
  await opts.client.acl.delete({
    calendarId: input.calendarId,
    ruleId: input.ruleId,
  });

  return { removed: true as const, ruleId: input.ruleId };
}

export const calendarRemoveSharingTool = defineTool({
  name: "calendar.removeSharing",
  resource: "calendar",
  capability: "delete",
  description: "Revoke a user's access to a calendar by removing their ACL rule.",
  destructive: true,
  input: z.object({
    calendarId: z.string().min(1).describe("Calendar ID."),
    ruleId: z.string().min(1).describe("The ACL rule ID to remove. Get this from calendar.listSharing."),
  }),
  output: z.object({
    removed: z.literal(true),
    ruleId: z.string(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return removeSharing(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarRemoveSharingTool);
}
