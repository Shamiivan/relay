import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import { instantlyCampaignShareTool, shareInstantlyCampaign } from "./tool.ts";

test("shareInstantlyCampaign treats 204 no-content as success", async () => {
  let capturedUrl = "";
  let capturedMethod = "";

  const result = await shareInstantlyCampaign(
    { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async (input, init) => {
        capturedUrl = input;
        capturedMethod = String(init?.method ?? "");
        return {
          ok: true,
          status: 204,
          headers: { get() { return null; } },
          async text() { return ""; },
          async json() { return null; },
        };
      },
    },
  );

  assert.equal(
    capturedUrl,
    "https://api.instantly.ai/api/v2/campaigns/019c0e38-c5be-70d5-b730-fdd27bea4548/share",
  );
  assert.equal(capturedMethod, "POST");
  assert.deepEqual(result, {
    shared: true,
    campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
  });
});

test("shareInstantlyCampaign validates input before network", async () => {
  await assert.rejects(
    shareInstantlyCampaign(
      { campaignId: "bad-id" },
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

test("shareInstantlyCampaign maps auth and rate limit failures", async () => {
  await assert.rejects(
    shareInstantlyCampaign(
      { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          headers: { get() { return null; } },
          async text() { return "Unauthorized"; },
          async json() { return {}; },
        }),
      },
    ),
    (error: unknown) => error instanceof InstantlyApiError && error.status === 401,
  );

  assert.deepEqual(
    instantlyCampaignShareTool.onError?.(new InstantlyApiError(401, "Unauthorized")),
    { type: "auth_error", message: "Unauthorized" },
  );
  assert.deepEqual(
    instantlyCampaignShareTool.onError?.(new InstantlyApiError(429, "Too Many Requests")),
    { type: "rate_limit_error", message: "Too Many Requests" },
  );
});
