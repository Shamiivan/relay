import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo contacts/bulk_update request body.",
  ),
});

export const apolloContactBulkUpdateTool = createApolloRawTool({
  name: "apollo.contact.bulkUpdate",
  resource: "apollo.contact",
  capability: "update",
  description: "Bulk update Apollo contacts.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/contacts/bulk_update",
  inputSchema,
  buildBody: (input) => input.body,
  destructive: true,
  idempotent: false,
  fallbackErrorMessage: "Unknown Apollo contact bulk update error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloContactBulkUpdateTool);
}
