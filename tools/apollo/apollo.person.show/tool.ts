import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  id: z.string().min(1).optional().describe(
    "Apollo person ID convenience alias.",
  ),
  body: z.object({}).passthrough().optional().describe(
    "Native Apollo people/show request body.",
  ),
}).refine(
  (value) => value.id !== undefined || value.body !== undefined,
  {
    message: "Provide id or body",
    path: ["id"],
  },
);

export const apolloPersonShowTool = createApolloRawTool({
  name: "apollo.person.show",
  resource: "apollo.person",
  capability: "read",
  description: "Fetch a single Apollo person record by ID or native show arguments.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/people/show",
  inputSchema,
  buildBody: (input) => ({
    ...(input.body ?? {}),
    ...(input.id ? { id: input.id } : {}),
  }),
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo person show error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloPersonShowTool);
}
