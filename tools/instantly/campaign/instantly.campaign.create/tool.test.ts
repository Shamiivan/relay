import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import { createInstantlyCampaign, instantlyCampaignCreateTool } from "./tool.ts";

test("createInstantlyCampaign fills schedule timezone from the legacy top-level field", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;
  let capturedBody = "";

  const result = await createInstantlyCampaign(
    {
      name: "Q2 Outbound",
      campaign_schedule: {
        timezone: "America/Chicago",
        schedules: [{
          name: "Weekdays",
          timing: { from: "09:00", to: "17:00" },
          days: { 1: true, 2: true, 3: true, 4: true, 5: true },
        }],
      },
      email_list: ["sender@example.com"],
      daily_limit: 50,
    },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
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
              id: "019c0e38-c5be-70d5-b730-fdd27bea4548",
              name: "Q2 Outbound",
              status: 0,
            };
          },
        };
      },
    },
  );

  assert.equal(capturedUrl, "https://api.instantly.ai/api/v2/campaigns");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: "Bearer test-key",
  });
  assert.deepEqual(JSON.parse(capturedBody), {
    name: "Q2 Outbound",
    campaign_schedule: {
      timezone: "America/Chicago",
      schedules: [{
        name: "Weekdays",
        timezone: "America/Chicago",
        timing: { from: "09:00", to: "17:00" },
        days: { 1: true, 2: true, 3: true, 4: true, 5: true },
      }],
    },
    email_list: ["sender@example.com"],
    daily_limit: 50,
  });
  assert.deepEqual(result, {
    campaign: {
      id: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      name: "Q2 Outbound",
      status: 0,
    },
  });
});

test("createInstantlyCampaign accepts explicit schedule timezones without a top-level timezone", async () => {
  let capturedBody = "";

  await createInstantlyCampaign(
    {
      name: "Q2 Outbound",
      campaign_schedule: {
        schedules: [{
          name: "Weekdays",
          timezone: "America/Chicago",
          timing: { from: "09:00", to: "17:00" },
          days: { 1: true, 2: true, 3: true, 4: true, 5: true },
        }],
      },
    },
    {
      env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
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
              id: "019c0e38-c5be-70d5-b730-fdd27bea4548",
              name: "Q2 Outbound",
              status: 0,
            };
          },
        };
      },
    },
  );

  assert.equal(
    JSON.parse(capturedBody).campaign_schedule.schedules[0].timezone,
    "America/Chicago",
  );
});

test("createInstantlyCampaign rejects schedules that still have no timezone", async () => {
  await assert.rejects(
    createInstantlyCampaign(
      {
        name: "Q2 Outbound",
        campaign_schedule: {
          schedules: [{
            name: "Weekdays",
            timing: { from: "09:00", to: "17:00" },
            days: { 1: true, 2: true, 3: true, 4: true, 5: true },
          }],
        },
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
});

test("createInstantlyCampaign rejects unsupported Instantly timezone values before fetch", async () => {
  await assert.rejects(
    createInstantlyCampaign(
      {
        name: "Q2 Outbound",
        campaign_schedule: {
          schedules: [{
            name: "Weekdays",
            timezone: "America/Toronto",
            timing: { from: "09:00", to: "17:00" },
            days: { 1: true, 2: true, 3: true, 4: true, 5: true },
          }],
        },
      },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run for invalid timezone input");
        },
      },
    ),
    z.ZodError,
  );
});

test("createInstantlyCampaign surfaces auth and rate limit statuses distinctly", async () => {
  await assert.rejects(
    createInstantlyCampaign(
      {
        name: "Q2 Outbound",
        campaign_schedule: {
          schedules: [{
            name: "Weekdays",
            timezone: "America/Chicago",
            timing: { from: "09:00", to: "17:00" },
            days: { 1: true, 2: true, 3: true, 4: true, 5: true },
          }],
        },
      },
      {
        env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 429,
          headers: { get() { return null; } },
          async text() {
            return "Too Many Requests";
          },
          async json() {
            return {};
          },
        }),
      },
    ),
    (error: unknown) => error instanceof InstantlyApiError && error.status === 429,
  );

  assert.deepEqual(
    instantlyCampaignCreateTool.onError?.(new InstantlyApiError(403, "Forbidden")),
    { type: "auth_error", message: "Forbidden" },
  );
  assert.deepEqual(
    instantlyCampaignCreateTool.onError?.(new InstantlyApiError(429, "Too Many Requests")),
    { type: "rate_limit_error", message: "Too Many Requests" },
  );
});
