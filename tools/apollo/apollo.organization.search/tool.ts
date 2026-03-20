import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo organizations/search request body.",
  ),
});

export const apolloOrganizationSearchTool = createApolloRawTool({
  name: "apollo.organization.search",
  resource: "apollo.organization",
  capability: "search",
  description: "Search Apollo organizations using the direct organizations search endpoint.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/organizations/search",
  inputSchema,
  buildBody: (input) => input.body,
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo organization search error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloOrganizationSearchTool);
}
