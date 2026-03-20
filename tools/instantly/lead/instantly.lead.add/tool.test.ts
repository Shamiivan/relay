import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import { addInstantlyLeads, instantlyLeadAddTool } from "./tool.ts";

test("addInstantlyLeads posts the documented bulk import payload and maps the response", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;
  let capturedBody = "";

  const result = await addInstantlyLeads(
    {
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      blocklistId: "019c0e38-c5be-70d5-b730-fdd27bea4549",
      assignedTo: "019c0e38-c5be-70d5-b730-fdd27bea4550",
      verifyLeadsOnImport: true,
      skipIfInWorkspace: true,
      skipIfInCampaign: false,
      skipIfInList: true,
      leads: [{
        email: "ada@example.com",
        personalization: "Mention the technical blog post.",
        website: "https://example.com",
        lastName: "Lovelace",
        firstName: "Ada",
        companyName: "Analytical Engines",
        phone: "+15555550123",
        ltInterestStatus: 2,
        plValueLead: 42,
        assignedTo: "019c0e38-c5be-70d5-b730-fdd27bea4551",
        customVariables: {
          company_size: "50-100",
        },
      }],
    },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async (input, init) => {
        capturedUrl = input;
        capturedHeaders = init?.headers;
        capturedBody = String(init?.body ?? "");
        return {
          ok: true,
          status: 200,
          headers: { get() { return null; } },
          async text() {
            return "";
          },
          async json() {
            return {
              status: "success",
              leads_count: 1,
              invalid_emails_count: 0,
              duplicate_emails_count: 0,
              leads: [{
                id: "lead-1",
                email: "ada@example.com",
              }],
            };
          },
        };
      },
    },
  );

  assert.equal(capturedUrl, "https://api.instantly.ai/api/v2/leads/add");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: "Bearer test-key",
  });
  assert.deepEqual(JSON.parse(capturedBody), {
    campaign_id: "019c0e38-c5be-70d5-b730-fdd27bea4548",
    blocklist_id: "019c0e38-c5be-70d5-b730-fdd27bea4549",
    assigned_to: "019c0e38-c5be-70d5-b730-fdd27bea4550",
    verify_leads_on_import: true,
    skip_if_in_workspace: true,
    skip_if_in_campaign: false,
    skip_if_in_list: true,
    leads: [{
      email: "ada@example.com",
      personalization: "Mention the technical blog post.",
      website: "https://example.com",
      last_name: "Lovelace",
      first_name: "Ada",
      company_name: "Analytical Engines",
      phone: "+15555550123",
      lt_interest_status: 2,
      pl_value_lead: 42,
      assigned_to: "019c0e38-c5be-70d5-b730-fdd27bea4551",
      custom_variables: {
        company_size: "50-100",
      },
    }],
  });
  assert.deepEqual(result, {
    status: "success",
    leadsCount: 1,
    invalidEmailsCount: 0,
    duplicateEmailsCount: 0,
    leads: [{
      id: "lead-1",
      email: "ada@example.com",
    }],
  });
});

test("addInstantlyLeads supports list targets and default counters", async () => {
  const result = await addInstantlyLeads(
    {
      listId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      leads: [{ email: "ada@example.com" }],
    },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async text() {
          return "";
        },
        async json() {
          return {};
        },
      }),
    },
  );

  assert.deepEqual(result, {
    status: "ok",
    leadsCount: 1,
    invalidEmailsCount: 0,
    duplicateEmailsCount: 0,
    leads: [],
  });
});

test("addInstantlyLeads surfaces auth and rate limit statuses distinctly", async () => {
  await assert.rejects(
    addInstantlyLeads(
      {
        campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
        leads: [{ email: "ada@example.com" }],
      },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 429,
          headers: { get() { return null; } },
          async text() {
            return "Too Many Requests";
          },
          async json() {
            return {};
          },
        }),
      },
    ),
    (error: unknown) => error instanceof InstantlyApiError && error.status === 429,
  );

  assert.deepEqual(
    instantlyLeadAddTool.onError?.(new InstantlyApiError(429, "Too Many Requests")),
    { type: "rate_limit_error", message: "Too Many Requests" },
  );
});

test("addInstantlyLeads enforces exactly one target before hitting the API", async () => {
  await assert.rejects(
    addInstantlyLeads(
      {
        leads: [{ email: "ada@example.com" }],
      } as never,
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run for invalid input");
        },
      },
    ),
    z.ZodError,
  );
});
