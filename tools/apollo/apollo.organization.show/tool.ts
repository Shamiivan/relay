import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  id: z.string().min(1).optional().describe(
    "Apollo organization ID convenience alias.",
  ),
  body: z.object({}).passthrough().optional().describe(
    "Native Apollo organizations/show request body.",
  ),
}).refine(
  (value) => value.id !== undefined || value.body !== undefined,
  {
    message: "Provide id or body",
    path: ["id"],
  },
);

export const apolloOrganizationShowTool = createApolloRawTool({
  name: "apollo.organization.show",
  resource: "apollo.organization",
  capability: "read",
  description: "Fetch a single Apollo organization record by ID or native show arguments.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/organizations/show",
  inputSchema,
  buildBody: (input) => ({
    ...(input.body ?? {}),
    ...(input.id ? { id: input.id } : {}),
  }),
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo organization show error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloOrganizationShowTool);
}
