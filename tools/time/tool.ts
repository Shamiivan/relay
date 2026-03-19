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
  }),
  prompt: { files: [] },
  handler() {
    const now = new Date();
    return {
      iso: now.toISOString(),
      local: now.toLocaleString(),
      timestamp: now.getTime(),
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(timeTool);
}
