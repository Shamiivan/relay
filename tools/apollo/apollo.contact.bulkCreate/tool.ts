import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo contacts/bulk_create request body.",
  ),
});

export const apolloContactBulkCreateTool = createApolloRawTool({
  name: "apollo.contact.bulkCreate",
  resource: "apollo.contact",
  capability: "create",
  description: "Bulk create Apollo contacts.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/contacts/bulk_create",
  inputSchema,
  buildBody: (input) => input.body,
  destructive: true,
  idempotent: false,
  fallbackErrorMessage: "Unknown Apollo contact bulk create error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloContactBulkCreateTool);
}
