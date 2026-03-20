import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo people/bulk_match request body.",
  ),
});

export const apolloPersonBulkMatchTool = createApolloRawTool({
  name: "apollo.person.bulkMatch",
  resource: "apollo.person",
  capability: "read",
  description: "Bulk match multiple people using Apollo's people bulk match endpoint.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/people/bulk_match",
  inputSchema,
  buildBody: (input) => input.body,
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo person bulk match error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloPersonBulkMatchTool);
}
