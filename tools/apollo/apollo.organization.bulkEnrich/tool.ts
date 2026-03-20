import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo organizations/bulk_enrich request body.",
  ),
});

export const apolloOrganizationBulkEnrichTool = createApolloRawTool({
  name: "apollo.organization.bulkEnrich",
  resource: "apollo.organization",
  capability: "read",
  description: "Bulk enrich multiple organizations using Apollo's bulk enrich endpoint.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/organizations/bulk_enrich",
  inputSchema,
  buildBody: (input) => input.body,
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo organization bulk enrich error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloOrganizationBulkEnrichTool);
}
