import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  body: z.object({}).passthrough().describe(
    "Native Apollo people/match request body.",
  ),
});

export const apolloPersonMatchTool = createApolloRawTool({
  name: "apollo.person.match",
  resource: "apollo.person",
  capability: "read",
  description: "Match a single person using Apollo's direct people match endpoint.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/people/match",
  inputSchema,
  buildBody: (input) => input.body,
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo person match error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloPersonMatchTool);
}
