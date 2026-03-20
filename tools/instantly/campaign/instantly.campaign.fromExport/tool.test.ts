import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import {
  createInstantlyCampaignFromExport,
  instantlyCampaignFromExportTool,
} from "./tool.ts";

test("createInstantlyCampaignFromExport uses the shared campaign export endpoint", async () => {
  let capturedUrl = "";

  const result = await createInstantlyCampaignFromExport(
    { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async (input) => {
        capturedUrl = input;
        return {
          ok: true,
          status: 200,
          headers: { get() { return null; } },
          async text() { return ""; },
          async json() {
            return {
              id: "campaign-2",
              name: "Imported campaign",
              status: 0,
            };
          },
        };
      },
    },
  );

  assert.equal(
    capturedUrl,
    "https://api.instantly.ai/api/v2/campaigns/019c0e38-c5be-70d5-b730-fdd27bea4548/from-export",
  );
  assert.deepEqual(result, {
    campaign: {
      id: "campaign-2",
      name: "Imported campaign",
      status: 0,
    },
  });
});

test("createInstantlyCampaignFromExport validates input and malformed payloads", async () => {
  await assert.rejects(
    createInstantlyCampaignFromExport(
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

  const malformed = await createInstantlyCampaignFromExport(
    { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async text() { return ""; },
        async json() { return { id: "campaign-2" }; },
      }),
    },
  ).then(() => null, (error: unknown) => error);

  assert.deepEqual(instantlyCampaignFromExportTool.onError?.(malformed), {
    type: "external_error",
    message: "Unexpected Instantly response shape",
  });
});

test("createInstantlyCampaignFromExport maps auth and rate limit errors", async () => {
  await assert.rejects(
    createInstantlyCampaignFromExport(
      { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 404,
          headers: { get() { return null; } },
          async text() { return "Not Found"; },
          async json() { return {}; },
        }),
      },
    ),
    (error: unknown) => error instanceof InstantlyApiError && error.status === 404,
  );

  assert.deepEqual(
    instantlyCampaignFromExportTool.onError?.(new InstantlyApiError(403, "Forbidden")),
    { type: "auth_error", message: "Forbidden" },
  );
  assert.deepEqual(
    instantlyCampaignFromExportTool.onError?.(new InstantlyApiError(429, "Too Many Requests")),
    { type: "rate_limit_error", message: "Too Many Requests" },
  );
});
