import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { InstantlyApiError } from "../../lib/errors.ts";
import { instantlyEmailSearchTool, searchInstantlyEmails } from "./tool.ts";

test("searchInstantlyEmails maps Instantly emails into the tool output shape", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;

  const result = await searchInstantlyEmails(
    {
      limit: 2,
      startingAfter: "email-cursor",
      search: "welcome",
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      listId: "019c0e38-c5be-70d5-b730-fdd27bea4549",
      iStatus: 1,
      eaccount: ["sender@example.com", "sender2@example.com"],
      isUnread: true,
      hasReminder: true,
      mode: "emode_focused",
      previewOnly: true,
      sortOrder: "asc",
      scheduledOnly: false,
      assignedTo: "019c0e38-c5be-70d5-b730-fdd27bea4550",
      lead: "lead@example.com",
      companyDomain: "example.com",
      markedAsDone: false,
      emailType: "received",
      minTimestampCreated: "2026-03-01T00:00:00.000Z",
      maxTimestampCreated: "2026-03-31T00:00:00.000Z",
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
                id: "email-1",
                subject: "Welcome",
                from_address_email: "sender@example.com",
                lead: "lead@example.com",
                eaccount: "sender@example.com",
                campaign_id: "019c0e38-c5be-70d5-b730-fdd27bea4548",
                thread_id: "thread-1",
                is_unread: 1,
                timestamp_created: "2026-03-05T00:00:00.000Z",
              }],
              next_starting_after: "email-next",
            };
          },
        };
      },
    },
  );

  const url = new URL(capturedUrl);
  assert.equal(url.origin + url.pathname, "https://api.instantly.ai/api/v2/emails");
  assert.equal(url.searchParams.get("limit"), "2");
  assert.equal(url.searchParams.get("starting_after"), "email-cursor");
  assert.equal(url.searchParams.get("search"), "welcome");
  assert.equal(url.searchParams.get("campaign_id"), "019c0e38-c5be-70d5-b730-fdd27bea4548");
  assert.equal(url.searchParams.get("list_id"), "019c0e38-c5be-70d5-b730-fdd27bea4549");
  assert.equal(url.searchParams.get("i_status"), "1");
  assert.equal(url.searchParams.get("eaccount"), "sender@example.com,sender2@example.com");
  assert.equal(url.searchParams.get("is_unread"), "true");
  assert.equal(url.searchParams.get("has_reminder"), "true");
  assert.equal(url.searchParams.get("mode"), "emode_focused");
  assert.equal(url.searchParams.get("preview_only"), "true");
  assert.equal(url.searchParams.get("sort_order"), "asc");
  assert.equal(url.searchParams.get("scheduled_only"), "false");
  assert.equal(url.searchParams.get("assigned_to"), "019c0e38-c5be-70d5-b730-fdd27bea4550");
  assert.equal(url.searchParams.get("lead"), "lead@example.com");
  assert.equal(url.searchParams.get("company_domain"), "example.com");
  assert.equal(url.searchParams.get("marked_as_done"), "false");
  assert.equal(url.searchParams.get("email_type"), "received");
  assert.equal(url.searchParams.get("min_timestamp_created"), "2026-03-01T00:00:00.000Z");
  assert.equal(url.searchParams.get("max_timestamp_created"), "2026-03-31T00:00:00.000Z");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    Authorization: "Bearer test-key",
  });
  assert.deepEqual(result, {
    emails: [{
      id: "email-1",
      subject: "Welcome",
      fromAddressEmail: "sender@example.com",
      leadEmail: "lead@example.com",
      eaccount: "sender@example.com",
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      threadId: "thread-1",
      unread: true,
      timestampCreated: "2026-03-05T00:00:00.000Z",
    }],
    nextStartingAfter: "email-next",
  });
});

test("searchInstantlyEmails keeps nullable fields stable", async () => {
  const result = await searchInstantlyEmails(
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
            items: [{ id: "email-2" }],
            next_starting_after: null,
          };
        },
      }),
    },
  );

  assert.deepEqual(result, {
    emails: [{
      id: "email-2",
      subject: null,
      fromAddressEmail: null,
      leadEmail: null,
      eaccount: null,
      campaignId: null,
      threadId: null,
      unread: false,
    }],
    nextStartingAfter: undefined,
  });
});

test("searchInstantlyEmails surfaces auth and rate limit statuses distinctly", async () => {
  await assert.rejects(
    searchInstantlyEmails(
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

  assert.deepEqual(
    instantlyEmailSearchTool.onError?.(new InstantlyApiError(401, "Unauthorized")),
    { type: "auth_error", message: "Unauthorized" },
  );
  assert.deepEqual(
    instantlyEmailSearchTool.onError?.(new InstantlyApiError(429, "Too Many Requests")),
    { type: "rate_limit_error", message: "Too Many Requests" },
  );
});

test("searchInstantlyEmails rejects invalid campaign IDs before hitting the API", async () => {
  await assert.rejects(
    searchInstantlyEmails(
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
});
