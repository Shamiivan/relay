import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { ApolloApiError } from "../lib/errors.ts";
import {
  apolloSearchCompaniesTool,
  searchApolloCompanies,
} from "./tool.ts";

test("searchApolloCompanies maps Apollo companies into the tool output shape", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;
  let capturedBody = "";

  const result = await searchApolloCompanies(
    {
      page: 2,
      perPage: 2,
      keywords: "developer tools",
      industries: ["software", "saas"],
      industryTagIds: ["5567cd4773696439b10b0000"],
      locations: ["Toronto, Canada"],
      employeeCountMin: 11,
      employeeCountMax: 200,
      organizationDomains: ["example.com"],
    },
    {
      env: { APOLLO_API_KEY: "test-key" } as NodeJS.ProcessEnv,
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
              organizations: [
                {
                  id: "org-1",
                  name: "Example Corp",
                  primary_domain: "example.com",
                  industry: "Software",
                  estimated_num_employees: 57,
                },
              ],
              pagination: {
                total_entries: 7,
              },
            };
          },
        };
      },
    },
  );

  assert.equal(capturedUrl, "https://api.apollo.io/api/v1/mixed_companies/search");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Api-Key": "test-key",
  });
  assert.deepEqual(JSON.parse(capturedBody), {
    page: 2,
    per_page: 2,
    q_keywords: "developer tools software saas",
    organization_locations: ["Toronto, Canada"],
    organization_num_employees_ranges: ["11,200"],
    organization_industry_tag_ids: ["5567cd4773696439b10b0000"],
    organization_domains: ["example.com"],
  });
  assert.deepEqual(result, {
    companies: [
      {
        id: "org-1",
        name: "Example Corp",
        domain: "example.com",
        industry: "Software",
        estimatedEmployeeCount: 57,
      },
    ],
    totalCount: 7,
    hasMore: true,
  });
});

test("searchApolloCompanies normalizes website URLs into domains and keeps empty pages stable", async () => {
  const result = await searchApolloCompanies(
    { page: 1, perPage: 25 },
    {
      env: { APOLLO_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async text() {
          return "";
        },
        async json() {
          return {
            organizations: [
              {
                id: "org-2",
                name: "Acme",
                website_url: "https://www.acme.test/about",
                estimated_num_employees: null,
              },
            ],
            pagination: {
              total_entries: 1,
            },
          };
        },
      }),
    },
  );

  assert.deepEqual(result, {
    companies: [
      {
        id: "org-2",
        name: "Acme",
        domain: "acme.test",
        industry: null,
        estimatedEmployeeCount: null,
      },
    ],
    totalCount: 1,
    hasMore: false,
  });
});

test("searchApolloCompanies surfaces auth and rate limit statuses distinctly", async () => {
  await assert.rejects(
    searchApolloCompanies(
      { page: 1 },
      {
        env: { APOLLO_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          headers: { get() { return null; } },
          async text() {
            return "Unauthorized";
          },
          async json() {
            return {};
          },
        }),
      },
    ),
    (error: unknown) => error instanceof ApolloApiError && error.status === 401,
  );

  const authError = apolloSearchCompaniesTool.onError?.(
    new ApolloApiError(401, "Unauthorized"),
  );
  const rateLimitError = apolloSearchCompaniesTool.onError?.(
    new ApolloApiError(429, "Too Many Requests"),
  );

  assert.deepEqual(authError, {
    type: "auth_error",
    message: "Unauthorized",
  });
  assert.deepEqual(rateLimitError, {
    type: "rate_limit_error",
    message: "Too Many Requests",
  });
});

test("searchApolloCompanies rejects invalid employee range input before hitting the API", async () => {
  await assert.rejects(
    searchApolloCompanies(
      { employeeCountMin: 500, employeeCountMax: 10 },
      {
        env: { APOLLO_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run for invalid input");
        },
      },
    ),
    z.ZodError,
  );
});

test("searchApolloCompanies fails clearly when APOLLO_API_KEY is missing", async () => {
  await assert.rejects(
    searchApolloCompanies(
      { page: 1 },
      {
        env: {} as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run without credentials");
        },
      },
    ),
    /Missing APOLLO_API_KEY/,
  );
});

test("searchApolloCompanies reports malformed payloads as external errors", async () => {
  const error = await searchApolloCompanies(
    { page: 1 },
    {
      env: { APOLLO_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async text() {
          return "";
        },
        async json() {
          return { organizations: [{ id: 123 }] };
        },
      }),
    },
  ).then(
    () => null,
    (caught: unknown) => caught,
  );

  assert.deepEqual(apolloSearchCompaniesTool.onError?.(error), {
    type: "external_error",
    message: "Unexpected Apollo response shape",
  });
});
