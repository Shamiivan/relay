import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import {
  duplicateInstantlyCampaign,
  instantlyCampaignDuplicateTool,
} from "./tool.ts";

test("duplicateInstantlyCampaign posts an optional name and maps the created campaign", async () => {
  let capturedUrl = "";
  let capturedBody = "";

  const result = await duplicateInstantlyCampaign(
    {
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      name: "Copied campaign",
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
              id: "campaign-copy",
              name: "Copied campaign",
              status: 0,
              timestamp_created: "2026-03-19T10:00:00.000Z",
            };
          },
        };
      },
    },
  );

  assert.equal(
    capturedUrl,
    "https://api.instantly.ai/api/v2/campaigns/019c0e38-c5be-70d5-b730-fdd27bea4548/duplicate",
  );
  assert.deepEqual(JSON.parse(capturedBody), { name: "Copied campaign" });
  assert.deepEqual(result, {
    campaign: {
      id: "campaign-copy",
      name: "Copied campaign",
      status: 0,
      timestampCreated: "2026-03-19T10:00:00.000Z",
    },
  });
});

test("duplicateInstantlyCampaign maps validation and malformed upstream failures", async () => {
  await assert.rejects(
    duplicateInstantlyCampaign(
      { campaignId: "not-a-uuid" },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run for invalid input");
        },
      },
    ),
    z.ZodError,
  );

  const malformed = await duplicateInstantlyCampaign(
    { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async text() { return ""; },
        async json() { return { id: "campaign-copy" }; },
      }),
    },
  ).then(() => null, (error: unknown) => error);

  assert.deepEqual(instantlyCampaignDuplicateTool.onError?.(malformed), {
    type: "external_error",
    message: "Unexpected Instantly response shape",
  });
});

test("duplicateInstantlyCampaign surfaces upstream auth and validation statuses", async () => {
  await assert.rejects(
    duplicateInstantlyCampaign(
      { campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548" },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          headers: { get() { return null; } },
          async text() { return "Name already exists"; },
          async json() { return {}; },
        }),
      },
    ),
    (error: unknown) => error instanceof InstantlyApiError && error.status === 400,
  );

  assert.deepEqual(
    instantlyCampaignDuplicateTool.onError?.(new InstantlyApiError(401, "Unauthorized")),
    { type: "auth_error", message: "Unauthorized" },
  );
  assert.deepEqual(
    instantlyCampaignDuplicateTool.onError?.(new InstantlyApiError(400, "Name already exists")),
    { type: "validation", message: "Name already exists" },
  );
});
