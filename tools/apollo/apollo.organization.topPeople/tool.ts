import { z } from "zod";
import { promptFile, runDeclaredTool } from "../../sdk";
import { createApolloRawTool } from "../lib/tooling.ts";

const inputSchema = z.object({
  organizationId: z.string().min(1).optional().describe(
    "Single Apollo organization ID convenience alias.",
  ),
  organizationIds: z.array(z.string().min(1)).min(1).optional().describe(
    "Apollo organization IDs convenience alias.",
  ),
  body: z.object({}).passthrough().optional().describe(
    "Additional native Apollo organization_top_people request fields.",
  ),
}).refine(
  (value) => value.organizationId !== undefined
    || value.organizationIds !== undefined
    || value.body !== undefined,
  {
    message: "Provide organizationId, organizationIds, or body",
    path: ["organizationId"],
  },
);

export const apolloOrganizationTopPeopleTool = createApolloRawTool({
  name: "apollo.organization.topPeople",
  resource: "apollo.organization",
  capability: "read",
  description: "Fetch top Apollo contacts associated with one or more organizations.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/mixed_people/organization_top_people",
  inputSchema,
  buildBody: (input) => ({
    ...(input.body ?? {}),
    ...(input.organizationIds ? { organization_ids: input.organizationIds } : {}),
    ...(input.organizationId ? { organization_id: input.organizationId } : {}),
  }),
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo organization top people error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloOrganizationTopPeopleTool);
}
