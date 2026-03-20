import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import {
  instantlyCampaignSearchTool,
  searchInstantlyCampaigns,
} from "./tool.ts";

test("searchInstantlyCampaigns maps Instantly campaigns into the tool output shape", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;

  const result = await searchInstantlyCampaigns(
    {
      limit: 2,
      startingAfter: "cursor-123",
      search: "Summer Sale Campaign",
      tagIds: ["tag-1", "tag-2"],
      aiSdrId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      status: 1,
    },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async (input, init) => {
        capturedUrl = input;
        capturedHeaders = init?.headers;
        return {
          ok: true,
          status: 200,
          headers: { get() { return null; } },
          async text() {
            return "";
          },
          async json() {
            return {
              items: [
                {
                  id: "campaign-1",
                  name: "Summer Sale Campaign",
                  status: 1,
                  timestamp_created: "2026-01-30T09:25:22.952Z",
                  timestamp_updated: "2026-02-01T12:00:00.000Z",
                },
              ],
              next_starting_after: "cursor-456",
            };
          },
        };
      },
    },
  );

  const url = new URL(capturedUrl);
  assert.equal(url.origin + url.pathname, "https://api.instantly.ai/api/v2/campaigns");
  assert.equal(url.searchParams.get("limit"), "2");
  assert.equal(url.searchParams.get("starting_after"), "cursor-123");
  assert.equal(url.searchParams.get("search"), "Summer Sale Campaign");
  assert.equal(url.searchParams.get("tag_ids"), "tag-1,tag-2");
  assert.equal(url.searchParams.get("ai_sdr_id"), "019c0e38-c5be-70d5-b730-fdd27bea4548");
  assert.equal(url.searchParams.get("status"), "1");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    Authorization: "Bearer test-key",
  });
  assert.deepEqual(result, {
    campaigns: [
      {
        id: "campaign-1",
        name: "Summer Sale Campaign",
        status: 1,
        timestampCreated: "2026-01-30T09:25:22.952Z",
        timestampUpdated: "2026-02-01T12:00:00.000Z",
      },
    ],
    nextStartingAfter: "cursor-456",
  });
});

test("searchInstantlyCampaigns keeps nullable status and empty pagination stable", async () => {
  const result = await searchInstantlyCampaigns(
    { limit: 1 },
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
          return {
            items: [
              {
                id: "campaign-2",
                name: "Draft Campaign",
                status: null,
              },
            ],
            next_starting_after: null,
          };
        },
      }),
    },
  );

  assert.deepEqual(result, {
    campaigns: [
      {
        id: "campaign-2",
        name: "Draft Campaign",
        status: null,
      },
    ],
    nextStartingAfter: undefined,
  });
});

test("searchInstantlyCampaigns surfaces auth and rate limit statuses distinctly", async () => {
  await assert.rejects(
    searchInstantlyCampaigns(
      { limit: 5 },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
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
    (error: unknown) => error instanceof InstantlyApiError && error.status === 401,
  );

  const authError = instantlyCampaignSearchTool.onError?.(
    new InstantlyApiError(401, "Unauthorized"),
  );
  const rateLimitError = instantlyCampaignSearchTool.onError?.(
    new InstantlyApiError(429, "Too Many Requests"),
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

test("searchInstantlyCampaigns rejects invalid status input before hitting the API", async () => {
  await assert.rejects(
    searchInstantlyCampaigns(
      { status: 99 as -99 },
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

test("searchInstantlyCampaigns fails clearly when INSTANTLY_API_KEY is missing", async () => {
  await assert.rejects(
    searchInstantlyCampaigns(
      { limit: 5 },
      {
        env: {} as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run without credentials");
        },
      },
    ),
    /Missing INSTANTLY_API_KEY/,
  );
});

test("searchInstantlyCampaigns reports malformed payloads as external errors", async () => {
  const error = await searchInstantlyCampaigns(
    { limit: 5 },
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
          return { items: [{ id: "campaign-1" }] };
        },
      }),
    },
  ).then(
    () => null,
    (caught: unknown) => caught,
  );

  assert.deepEqual(
    instantlyCampaignSearchTool.onError?.(error),
    {
      type: "external_error",
      message: "Unexpected Instantly response shape",
    },
  );
});
