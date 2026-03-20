import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import {
  addInstantlyCampaignVariables,
  instantlyCampaignVariablesAddTool,
} from "./tool.ts";

test("addInstantlyCampaignVariables posts the documented variables payload", async () => {
  let capturedUrl = "";
  let capturedBody = "";

  const result = await addInstantlyCampaignVariables(
    {
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      variables: ["firstName", "companyName"],
    },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async (input, init) => {
        capturedUrl = input;
        capturedBody = String(init?.body ?? "");
        return {
          ok: true,
          status: 200,
          headers: { get() { return null; } },
          async text() { return ""; },
          async json() {
            return {
              id: "campaign-1",
              name: "Campaign with vars",
              status: 1,
            };
          },
        };
      },
    },
  );

  assert.equal(
    capturedUrl,
    "https://api.instantly.ai/api/v2/campaigns/019c0e38-c5be-70d5-b730-fdd27bea4548/variables",
  );
  assert.deepEqual(JSON.parse(capturedBody), {
    variables: ["firstName", "companyName"],
  });
  assert.deepEqual(result, {
    campaign: {
      id: "campaign-1",
      name: "Campaign with vars",
      status: 1,
    },
  });
});

test("addInstantlyCampaignVariables validates input and malformed payloads", async () => {
  await assert.rejects(
    addInstantlyCampaignVariables(
      {
        campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
        variables: [],
      },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run for invalid input");
        },
      },
    ),
    z.ZodError,
  );

  const malformed = await addInstantlyCampaignVariables(
    {
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      variables: ["firstName"],
    },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async text() { return ""; },
        async json() { return { id: "campaign-1" }; },
      }),
    },
  ).then(() => null, (error: unknown) => error);

  assert.deepEqual(instantlyCampaignVariablesAddTool.onError?.(malformed), {
    type: "external_error",
    message: "Unexpected Instantly response shape",
  });
});

test("addInstantlyCampaignVariables maps auth and rate limit errors", async () => {
  await assert.rejects(
    addInstantlyCampaignVariables(
      {
        campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
        variables: ["firstName"],
      },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 429,
          headers: { get() { return null; } },
          async text() { return "Too Many Requests"; },
          async json() { return {}; },
        }),
      },
    ),
    (error: unknown) => error instanceof InstantlyApiError && error.status === 429,
  );

  assert.deepEqual(
    instantlyCampaignVariablesAddTool.onError?.(new InstantlyApiError(403, "Forbidden")),
    { type: "auth_error", message: "Forbidden" },
  );
  assert.deepEqual(
    instantlyCampaignVariablesAddTool.onError?.(new InstantlyApiError(429, "Too Many Requests")),
    { type: "rate_limit_error", message: "Too Many Requests" },
  );
});
