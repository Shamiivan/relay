import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo reports/sync_report request body.",
  ),
});

export const apolloReportSyncTool = createApolloRawTool({
  name: "apollo.report.sync",
  resource: "apollo.report",
  capability: "read",
  description: "Run Apollo report sync using the direct sync_report endpoint.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/reports/sync_report",
  inputSchema,
  buildBody: (input) => input.body,
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo report sync error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloReportSyncTool);
}
