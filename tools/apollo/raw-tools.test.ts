import assert from "node:assert/strict";
import test from "node:test";
import { loadDotenv } from "../../packages/env/src/index.ts";
import { ApolloApiError } from "./lib/errors.ts";
import { apolloAccountBulkCreateTool } from "./apollo.account.bulkCreate/tool.ts";
import { apolloContactBulkCreateTool } from "./apollo.contact.bulkCreate/tool.ts";
import { apolloContactBulkUpdateTool } from "./apollo.contact.bulkUpdate/tool.ts";
import { apolloFieldCreateTool } from "./apollo.field.create/tool.ts";
import { apolloOrganizationBulkEnrichTool } from "./apollo.organization.bulkEnrich/tool.ts";
import { apolloOrganizationEnrichTool } from "./apollo.organization.enrich/tool.ts";
import { apolloOrganizationJobPostingsTool } from "./apollo.organization.jobPostings/tool.ts";
import { apolloOrganizationSearchTool } from "./apollo.organization.search/tool.ts";
import { apolloOrganizationShowTool } from "./apollo.organization.show/tool.ts";
import { apolloOrganizationTopPeopleTool } from "./apollo.organization.topPeople/tool.ts";
import { apolloPersonBulkMatchTool } from "./apollo.person.bulkMatch/tool.ts";
import { apolloPersonMatchTool } from "./apollo.person.match/tool.ts";
import { apolloPersonShowTool } from "./apollo.person.show/tool.ts";
import { apolloReportSyncTool } from "./apollo.report.sync/tool.ts";

const rawEndpointCases: Array<{
  tool: any;
  input: unknown;
  path: string;
  body: unknown;
}> = [
  {
    tool: apolloOrganizationSearchTool,
    input: { body: { q_keywords: "developer tools", per_page: 1 } },
    path: "/api/v1/organizations/search",
    body: { q_keywords: "developer tools", per_page: 1 },
  },
  {
    tool: apolloOrganizationTopPeopleTool,
    input: { organizationIds: ["org-1"], body: { page: 1 } },
    path: "/api/v1/mixed_people/organization_top_people",
    body: { organization_ids: ["org-1"], page: 1 },
  },
  {
    tool: apolloOrganizationJobPostingsTool,
    input: { organizationId: "org-1", body: { per_page: 1 } },
    path: "/api/v1/organizations/job_postings",
    body: { organization_id: "org-1", per_page: 1 },
  },
  {
    tool: apolloPersonShowTool,
    input: { id: "person-1" },
    path: "/api/v1/people/show",
    body: { id: "person-1" },
  },
  {
    tool: apolloPersonMatchTool,
    input: { body: { email: "person@example.com" } },
    path: "/api/v1/people/match",
    body: { email: "person@example.com" },
  },
  {
    tool: apolloPersonBulkMatchTool,
    input: { body: { details: [{ email: "person@example.com" }] } },
    path: "/api/v1/people/bulk_match",
    body: { details: [{ email: "person@example.com" }] },
  },
  {
    tool: apolloOrganizationShowTool,
    input: { id: "org-1" },
    path: "/api/v1/organizations/show",
    body: { id: "org-1" },
  },
  {
    tool: apolloOrganizationEnrichTool,
    input: { body: { domain: "example.com" } },
    path: "/api/v1/organizations/enrich",
    body: { domain: "example.com" },
  },
  {
    tool: apolloOrganizationBulkEnrichTool,
    input: { body: { domains: ["example.com"] } },
    path: "/api/v1/organizations/bulk_enrich",
    body: { domains: ["example.com"] },
  },
  {
    tool: apolloContactBulkCreateTool,
    input: { body: { contacts: [{ email: "person@example.com" }] } },
    path: "/api/v1/contacts/bulk_create",
    body: { contacts: [{ email: "person@example.com" }] },
  },
  {
    tool: apolloContactBulkUpdateTool,
    input: { body: { contacts: [{ id: "contact-1", first_name: "Taylor" }] } },
    path: "/api/v1/contacts/bulk_update",
    body: { contacts: [{ id: "contact-1", first_name: "Taylor" }] },
  },
  {
    tool: apolloAccountBulkCreateTool,
    input: { body: { accounts: [{ name: "Example Corp" }] } },
    path: "/api/v1/accounts/bulk_create",
    body: { accounts: [{ name: "Example Corp" }] },
  },
  {
    tool: apolloReportSyncTool,
    input: { body: { report_id: "report-1" } },
    path: "/api/v1/reports/sync_report",
    body: { report_id: "report-1" },
  },
  {
    tool: apolloFieldCreateTool,
    input: { body: { name: "Agency Stage", object_type: "contact" } },
    path: "/api/v1/fields/create",
    body: { name: "Agency Stage", object_type: "contact" },
  },
];

test("Apollo raw endpoint tools hit the expected path with X-Api-Key auth", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiKey = process.env.APOLLO_API_KEY;

  try {
    loadDotenv();
    const expectedApiKey = process.env.APOLLO_API_KEY?.trim() || "test-apollo-key";
    process.env.APOLLO_API_KEY = expectedApiKey;

    for (const endpoint of rawEndpointCases) {
      let capturedUrl = "";
      let capturedHeaders: Headers | undefined;
      let capturedBody = "";

      const fetchMock = (async (input: URL | RequestInfo, init?: RequestInit) => {
        capturedUrl = String(input);
        capturedHeaders = new Headers(init?.headers);
        capturedBody = String(init?.body ?? "");
        return {
          ok: true,
          status: 200,
          headers: { get() { return null; } },
          async text() {
            return "";
          },
          async json() {
            return { ok: true, endpoint: endpoint.tool.name };
          },
        };
      }) as unknown as typeof fetch;
      globalThis.fetch = fetchMock;

      const parsedInput = endpoint.tool.input.parse(endpoint.input) as unknown;
      const result = await endpoint.tool.handler({ input: parsedInput });

      assert.equal(new URL(capturedUrl).pathname, endpoint.path);
      assert.equal(capturedHeaders?.get("X-Api-Key"), expectedApiKey);
      assert.equal(capturedHeaders?.get("Authorization"), null);
      assert.deepEqual(JSON.parse(capturedBody), endpoint.body);
      assert.deepEqual(result, {
        response: { ok: true, endpoint: endpoint.tool.name },
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.APOLLO_API_KEY;
    } else {
      process.env.APOLLO_API_KEY = previousApiKey;
    }
  }
});

test("Apollo raw endpoint tools expose consistent auth error mapping", () => {
  const error = new ApolloApiError(401, "Unauthorized");

  for (const endpoint of rawEndpointCases) {
    assert.deepEqual(endpoint.tool.onError?.(error), {
      type: "auth_error",
      message: "Unauthorized",
    });
  }
});

test("Apollo raw mutating endpoint tools are marked destructive", () => {
  assert.equal(apolloContactBulkCreateTool.destructive, true);
  assert.equal(apolloContactBulkUpdateTool.destructive, true);
  assert.equal(apolloAccountBulkCreateTool.destructive, true);
  assert.equal(apolloFieldCreateTool.destructive, true);
});
