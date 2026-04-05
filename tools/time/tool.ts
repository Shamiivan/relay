import { z } from "zod";
import { defineTool, runDeclaredTool } from "../sdk";

export const timeTool = defineTool({
  moduleUrl: import.meta.url,
  name: "time.now",
  resource: "time",
  capability: "read",
  description: "Get the current date and time.",
  idempotent: false,
  input: z.object({}),
  output: z.object({
    iso: z.string().describe("ISO 8601 UTC timestamp"),
    local: z.string().describe("Locale-formatted local time string"),
    timestamp: z.number().describe("Unix timestamp in milliseconds"),
    timeZone: z.string().describe("IANA timezone of the server, e.g. America/Toronto. Use this in calendar tool timeZone fields."),
    utcOffset: z.string().describe("UTC offset string, e.g. -04:00"),
  }),
  prompt: { files: [] },
  handler() {
    const now = new Date();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offsetMinutes = now.getTimezoneOffset();
    const sign = offsetMinutes <= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const utcOffset = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
    return {
      iso: now.toISOString(),
      local: now.toLocaleString(),
      timestamp: now.getTime(),
      timeZone,
      utcOffset,
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(timeTool);
}
