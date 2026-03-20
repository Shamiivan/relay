import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo fields/create request body.",
  ),
});

export const apolloFieldCreateTool = createApolloRawTool({
  name: "apollo.field.create",
  resource: "apollo.field",
  capability: "create",
  description: "Create an Apollo custom field.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/fields/create",
  inputSchema,
  buildBody: (input) => input.body,
  destructive: true,
  idempotent: false,
  fallbackErrorMessage: "Unknown Apollo field create error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloFieldCreateTool);
}
