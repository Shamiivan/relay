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
    "Additional native Apollo organizations/job_postings request fields.",
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

export const apolloOrganizationJobPostingsTool = createApolloRawTool({
  name: "apollo.organization.jobPostings",
  resource: "apollo.organization",
  capability: "read",
  description: "Fetch Apollo organization job postings for account research.",
  prompt: promptFile("./prompt.md"),
  endpointPath: "/organizations/job_postings",
  inputSchema,
  buildBody: (input) => ({
    ...(input.body ?? {}),
    ...(input.organizationIds ? { organization_ids: input.organizationIds } : {}),
    ...(input.organizationId ? { organization_id: input.organizationId } : {}),
  }),
  idempotent: true,
  fallbackErrorMessage: "Unknown Apollo organization job postings error",
});

if (import.meta.main) {
  void runDeclaredTool(apolloOrganizationJobPostingsTool);
}
