import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { instantlyRequest, type InstantlyFetch } from "./client.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "./errors.ts";

test("instantlyRequest sends bearer auth, base URL override, and query params", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;

  const fetchImpl: InstantlyFetch = async (input, init) => {
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
        return { ok: true };
      },
    };
  };

  const result = await instantlyRequest(
    {
      path: "/campaigns",
      query: {
        limit: 10,
        search: "Summer Sale Campaign",
        tag_ids: ["tag-1", "tag-2"],
      },
      responseSchema: z.object({ ok: z.boolean() }),
    },
    {
      env: {
        INSTANTLY_API_KEY: "test-key",
        INSTANTLY_API_BASE_URL: "https://example.test/api/v2/",
      } as NodeJS.ProcessEnv,
      fetchImpl,
    },
  );

  const url = new URL(capturedUrl);
  assert.equal(url.origin + url.pathname, "https://example.test/api/v2/campaigns");
  assert.equal(url.searchParams.get("limit"), "10");
  assert.equal(url.searchParams.get("search"), "Summer Sale Campaign");
  assert.equal(url.searchParams.get("tag_ids"), "tag-1,tag-2");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    Authorization: "Bearer test-key",
  });
  assert.deepEqual(result, { ok: true });
});

test("instantlyRequest fails clearly when INSTANTLY_API_KEY is missing", async () => {
  await assert.rejects(
    instantlyRequest(
      {
        path: "/campaigns",
        responseSchema: z.object({ ok: z.boolean() }),
      },
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

test("instantlyRequest fails clearly when fetch is not available", async () => {
  const originalFetch = globalThis.fetch;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).fetch;
    await assert.rejects(
      instantlyRequest(
        {
          path: "/campaigns",
          responseSchema: z.object({ ok: z.boolean() }),
        },
        {
          env: { INSTANTLY_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        },
      ),
      /Fetch is not available in this runtime/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("instantlyRequest surfaces upstream HTTP failures", async () => {
  await assert.rejects(
    instantlyRequest(
      {
        path: "/campaigns",
        responseSchema: z.object({ ok: z.boolean() }),
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
});

test("instantlyRequest rejects malformed upstream JSON", async () => {
  await assert.rejects(
    instantlyRequest(
      {
        path: "/campaigns",
        responseSchema: z.object({ items: z.array(z.object({ id: z.string() })) }),
      },
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
            return { items: [{ wrong: "shape" }] };
          },
        }),
      },
    ),
    InstantlyResponseParseError,
  );
});
