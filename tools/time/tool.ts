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
    dayName: z.string().describe("Full day name, e.g. Monday"),
    datePretty: z.string().describe("Human-friendly date, e.g. Monday, April 13, 2026"),
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
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
    const datePretty = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return {
      iso: now.toISOString(),
      local: now.toLocaleString(),
      dayName,
      datePretty,
      timestamp: now.getTime(),
      timeZone,
      utcOffset,
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(timeTool);
}
