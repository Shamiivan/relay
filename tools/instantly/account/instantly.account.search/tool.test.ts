import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import { instantlyAccountSearchTool, searchInstantlyAccounts } from "./tool.ts";

test("searchInstantlyAccounts maps Instantly accounts into the tool output shape", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;

  const result = await searchInstantlyAccounts(
    {
      limit: 2,
      startingAfter: "acc-cursor",
      search: "sender@example.com",
      status: 1,
      providerCode: 2,
      tagIds: ["tag-1", "tag-2"],
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
              items: [{
                email: "sender@example.com",
                status: 1,
                provider_code: 2,
                warmup_status: 3,
                timestamp_created: "2026-03-01T00:00:00.000Z",
                timestamp_updated: "2026-03-02T00:00:00.000Z",
              }],
              next_starting_after: "next-acc",
            };
          },
        };
      },
    },
  );

  const url = new URL(capturedUrl);
  assert.equal(url.origin + url.pathname, "https://api.instantly.ai/api/v2/accounts");
  assert.equal(url.searchParams.get("limit"), "2");
  assert.equal(url.searchParams.get("starting_after"), "acc-cursor");
  assert.equal(url.searchParams.get("search"), "sender@example.com");
  assert.equal(url.searchParams.get("status"), "1");
  assert.equal(url.searchParams.get("provider_code"), "2");
  assert.equal(url.searchParams.get("tag_ids"), "tag-1,tag-2");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    Authorization: "Bearer test-key",
  });
  assert.deepEqual(result, {
    accounts: [{
      email: "sender@example.com",
      status: 1,
      providerCode: 2,
      warmupStatus: 3,
      timestampCreated: "2026-03-01T00:00:00.000Z",
      timestampUpdated: "2026-03-02T00:00:00.000Z",
    }],
    nextStartingAfter: "next-acc",
  });
});

test("searchInstantlyAccounts keeps nullable fields stable", async () => {
  const result = await searchInstantlyAccounts(
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
            items: [{
              email: "sender@example.com",
            }],
            next_starting_after: null,
          };
        },
      }),
    },
  );

  assert.deepEqual(result, {
    accounts: [{
      email: "sender@example.com",
      status: null,
      providerCode: null,
      warmupStatus: null,
    }],
    nextStartingAfter: undefined,
  });
});

test("searchInstantlyAccounts surfaces auth and rate limit statuses distinctly", async () => {
  await assert.rejects(
    searchInstantlyAccounts(
      { limit: 5 },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          headers: { get() { return null; } },
          async text() {
            return "Forbidden";
          },
          async json() {
            return {};
          },
        }),
      },
    ),
    (error: unknown) => error instanceof InstantlyApiError && error.status === 403,
  );

  assert.deepEqual(
    instantlyAccountSearchTool.onError?.(new InstantlyApiError(403, "Forbidden")),
    { type: "auth_error", message: "Forbidden" },
  );
  assert.deepEqual(
    instantlyAccountSearchTool.onError?.(new InstantlyApiError(429, "Too Many Requests")),
    { type: "rate_limit_error", message: "Too Many Requests" },
  );
});

test("searchInstantlyAccounts rejects invalid input before hitting the API", async () => {
  await assert.rejects(
    searchInstantlyAccounts(
      { limit: 0 },
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
