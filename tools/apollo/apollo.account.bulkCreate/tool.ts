import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo accounts/bulk_create request body.",
  ),
});

export const apolloAccountBulkCreateTool = createApolloRawTool({
  name: "apollo.account.bulkCreate",
  resource: "apollo.account",
  capability: "create",
  description: "Bulk create Apollo accounts.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/accounts/bulk_create",
  inputSchema,
  buildBody: (input) => input.body,
  destructive: true,
  idempotent: false,
  fallbackErrorMessage: "Unknown Apollo account bulk create error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloAccountBulkCreateTool);
}
