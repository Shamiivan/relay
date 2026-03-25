import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { ApolloApiError } from "../lib/errors.ts";
import {
  apolloSearchPeopleTool,
  searchApolloPeople,
} from "./tool.ts";

test("searchApolloPeople maps Apollo people into the tool output shape", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;
  let capturedBody = "";

  const result = await searchApolloPeople(
    {
      organizationIds: ["org-1", "org-2"],
      titles: ["VP Sales", "Head of Growth"],
      personLocations: ["California, US"],
      keywords: "outbound",
      body: {
        contact_email_status: ["verified"],
      },
      page: 2,
      perPage: 2,
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
              people: [
                {
                  id: "person-1",
                  first_name: "Taylor",
                  last_name: "Smith",
                  title: "VP Sales",
                  has_email: true,
                  organization: {
                    id: "org-1",
                    name: "Example Corp",
                  },
                },
              ],
              total_entries: 9,
            };
          },
        };
      },
    },
  );

  assert.equal(capturedUrl, "https://api.apollo.io/api/v1/mixed_people/api_search");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Api-Key": "test-key",
  });
  assert.deepEqual(JSON.parse(capturedBody), {
    organization_ids: ["org-1", "org-2"],
    person_titles: ["VP Sales", "Head of Growth"],
    person_locations: ["California, US"],
    q_keywords: "outbound",
    contact_email_status: ["verified"],
    page: 2,
    per_page: 2,
  });
  assert.deepEqual(result, {
    people: [
      {
        id: "person-1",
        firstName: "Taylor",
        lastName: "Smith",
        title: "VP Sales",
        organizationId: "org-1",
        organizationName: "Example Corp",
        hasEmail: true,
      },
    ],
    totalCount: 9,
    hasMore: true,
  });
});

test("searchApolloPeople normalizes boolean-style q_keywords into plain terms", async () => {
  let capturedBody = "";

  await searchApolloPeople(
    {
      titles: ["Founder"],
      keywords: "accounting OR accounting firm OR bookkeeping",
      perPage: 5,
    },
    {
      env: { APOLLO_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async (_input, init) => {
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
              people: [],
              total_entries: 0,
            };
          },
        };
      },
    },
  );

  assert.equal(
    JSON.parse(capturedBody).q_keywords,
    "accounting accounting firm bookkeeping",
  );
});

test("searchApolloPeople falls back to obfuscated last name and keeps nullable fields stable", async () => {
  const result = await searchApolloPeople(
    { organizationIds: ["org-1"], page: 1, perPage: 25 },
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
            people: [
              {
                id: "person-2",
                first_name: "Jordan",
                last_name_obfuscated: "D***",
                organization: null,
              },
            ],
            total_entries: 1,
          };
        },
      }),
    },
  );

  assert.deepEqual(result, {
    people: [
      {
        id: "person-2",
        firstName: "Jordan",
        lastName: "D***",
        title: null,
        organizationId: null,
        organizationName: null,
        hasEmail: null,
      },
    ],
    totalCount: 1,
    hasMore: false,
  });
});

test("searchApolloPeople surfaces auth and rate limit statuses distinctly", async () => {
  await assert.rejects(
    searchApolloPeople(
      { organizationIds: ["org-1"] },
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

  const authError = apolloSearchPeopleTool.onError?.(
    new ApolloApiError(401, "Unauthorized"),
  );
  const rateLimitError = apolloSearchPeopleTool.onError?.(
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

test("searchApolloPeople rejects invalid input before hitting the API", async () => {
  await assert.rejects(
    searchApolloPeople(
      { organizationIds: [] },
      {
        env: { APOLLO_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run for invalid input");
        },
      },
    ),
    z.ZodError,
  );

  await assert.rejects(
    searchApolloPeople(
      { titles: ["Founder"], keywords: "OR AND NOT" },
      {
        env: { APOLLO_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run for operator-only keywords");
        },
      },
    ),
    z.ZodError,
  );
});

test("searchApolloPeople fails clearly when APOLLO_API_KEY is missing", async () => {
  await assert.rejects(
    searchApolloPeople(
      { organizationIds: ["org-1"] },
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

test("searchApolloPeople reports malformed payloads as external errors", async () => {
  const error = await searchApolloPeople(
    { organizationIds: ["org-1"] },
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
          return { people: [{ id: "person-1" }] };
        },
      }),
    },
  ).then(
    () => null,
    (caught: unknown) => caught,
  );

  assert.deepEqual(apolloSearchPeopleTool.onError?.(error), {
    type: "external_error",
    message: "Unexpected Apollo response shape",
  });
});
