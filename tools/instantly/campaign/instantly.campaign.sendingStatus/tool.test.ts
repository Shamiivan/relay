import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import {
  getInstantlyCampaignSendingStatus,
  instantlyCampaignSendingStatusTool,
} from "./tool.ts";

test("getInstantlyCampaignSendingStatus maps the API payload and query flag", async () => {
  let capturedUrl = "";

  const result = await getInstantlyCampaignSendingStatus(
    {
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      withAiSummary: true,
    },
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
              diagnostics: {
                campaign_id: "019c0e38-c5be-70d5-b730-fdd27bea4548",
                last_updated: "2026-03-19T12:00:00.000Z",
                status: "ok",
                issue_tracking: { blockedAccounts: 0 },
              },
              summary: {
                title: "Healthy",
                description: "Campaign is sending normally.",
                severity: "info",
              },
            };
          },
        };
      },
    },
  );

  const url = new URL(capturedUrl);
  assert.equal(
    url.origin + url.pathname,
    "https://api.instantly.ai/api/v2/campaigns/019c0e38-c5be-70d5-b730-fdd27bea4548/sending-status",
  );
  assert.equal(url.searchParams.get("with_ai_summary"), "true");
  assert.deepEqual(result, {
    diagnostics: {
      campaign_id: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      last_updated: "2026-03-19T12:00:00.000Z",
      status: "ok",
      issue_tracking: { blockedAccounts: 0 },
    },
    summary: {
      title: "Healthy",
      description: "Campaign is sending normally.",
      severity: "info",
    },
  });
});

test("getInstantlyCampaignSendingStatus keeps nullable fields stable and validates input", async () => {
  const result = await getInstantlyCampaignSendingStatus(
    { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async text() { return ""; },
        async json() {
          return {
            diagnostics: null,
            summary: null,
          };
        },
      }),
    },
  );

  assert.deepEqual(result, { diagnostics: null, summary: null });

  await assert.rejects(
    getInstantlyCampaignSendingStatus(
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

test("getInstantlyCampaignSendingStatus maps auth, rate limit, and malformed payload errors", async () => {
  await assert.rejects(
    getInstantlyCampaignSendingStatus(
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

  const malformed = await getInstantlyCampaignSendingStatus(
    { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async text() { return ""; },
        async json() { return { diagnostics: "bad", summary: null }; },
      }),
    },
  ).then(() => null, (error: unknown) => error);

  assert.deepEqual(
    instantlyCampaignSendingStatusTool.onError?.(new InstantlyApiError(429, "Too Many Requests")),
    { type: "rate_limit_error", message: "Too Many Requests" },
  );
  assert.deepEqual(instantlyCampaignSendingStatusTool.onError?.(malformed), {
    type: "external_error",
    message: "Unexpected Instantly response shape",
  });
});
