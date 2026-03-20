import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo organizations/enrich request body.",
  ),
});

export const apolloOrganizationEnrichTool = createApolloRawTool({
  name: "apollo.organization.enrich",
  resource: "apollo.organization",
  capability: "read",
  description: "Enrich one organization using Apollo's organization enrich endpoint.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/organizations/enrich",
  inputSchema,
  buildBody: (input) => input.body,
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo organization enrich error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloOrganizationEnrichTool);
}
