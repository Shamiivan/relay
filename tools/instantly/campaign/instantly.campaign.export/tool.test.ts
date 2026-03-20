import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import {
  exportInstantlyCampaign,
  instantlyCampaignExportTool,
} from "./tool.ts";

test("exportInstantlyCampaign hits the documented endpoint and normalizes the campaign", async () => {
  let capturedUrl = "";

  const result = await exportInstantlyCampaign(
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
              id: "campaign-1",
              name: "Exported campaign",
              status: 1,
              timestamp_updated: "2026-03-19T10:00:00.000Z",
            };
          },
        };
      },
    },
  );

  assert.equal(
    capturedUrl,
    "https://api.instantly.ai/api/v2/campaigns/019c0e38-c5be-70d5-b730-fdd27bea4548/export",
  );
  assert.deepEqual(result, {
    campaign: {
      id: "campaign-1",
      name: "Exported campaign",
      status: 1,
      timestampUpdated: "2026-03-19T10:00:00.000Z",
    },
  });
});

test("exportInstantlyCampaign validates input and malformed payloads", async () => {
  await assert.rejects(
    exportInstantlyCampaign(
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

  const malformed = await exportInstantlyCampaign(
    { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
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

  assert.deepEqual(instantlyCampaignExportTool.onError?.(malformed), {
    type: "external_error",
    message: "Unexpected Instantly response shape",
  });
});

test("exportInstantlyCampaign maps auth and rate limit errors", async () => {
  await assert.rejects(
    exportInstantlyCampaign(
      { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
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
    instantlyCampaignExportTool.onError?.(new InstantlyApiError(403, "Forbidden")),
    { type: "auth_error", message: "Forbidden" },
  );
  assert.deepEqual(
    instantlyCampaignExportTool.onError?.(new InstantlyApiError(429, "Too Many Requests")),
    { type: "rate_limit_error", message: "Too Many Requests" },
  );
});
