import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import { calendarOnError } from "../on-error.ts";

export type CalendarClient = calendar_v3.Calendar;

export async function listSharing(
  input: { calendarId: string },
  opts: { client: CalendarClient },
) {
  const res = await opts.client.acl.list({
    calendarId: input.calendarId,
  });

  const rules = (res.data.items ?? []).map((rule) => ({
    id: rule.id ?? "",
    role: rule.role ?? "",
    scope: {
      type: rule.scope?.type ?? "",
      value: rule.scope?.value ?? "",
    },
  }));

  return { rules };
}

export const calendarListSharingTool = defineTool({
  name: "calendar.listSharing",
  resource: "calendar",
  capability: "search",
  description: "List the access control rules (sharing permissions) for a calendar.",
  idempotent: true,
  input: z.object({
    calendarId: z.string().min(1).describe("Calendar ID to list sharing rules for."),
  }),
  output: z.object({
    rules: z.array(z.object({
      id: z.string(),
      role: z.string(),
      scope: z.object({ type: z.string(), value: z.string() }),
    })).default([]),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.calendar({ version: "v3", auth: getGoogleAuth() });
    return listSharing(input, { client });
  },
  onError: calendarOnError,
});

if (import.meta.main) {
  void runDeclaredTool(calendarListSharingTool);
}
