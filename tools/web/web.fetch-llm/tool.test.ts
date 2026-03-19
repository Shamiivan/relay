import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  BraveContextError,
  BraveResponseParseError,
  fetchLlmContext,
  type LlmContextFetch,
  webFetchLlmTool,
} from "./tool.ts";

function makeBraveResponse(generic: unknown[]): Awaited<ReturnType<LlmContextFetch>> {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    async text() {
      return "";
    },
    async json() {
      return { grounding: { generic } };
    },
  };
}

test("fetchLlmContext maps grounding.generic into results and returns query", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;

  const result = await fetchLlmContext(
    { query: "B2B SaaS pain points", count: 2 },
    {
      env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async (input, init) => {
        capturedUrl = input;
        capturedHeaders = init?.headers;
        return makeBraveResponse([
          { url: "https://example.com/a", title: "Page A", snippets: ["Snippet one."] },
          { url: "https://example.com/b", title: "Page B", snippets: ["Snippet two."] },
        ]);
      },
    },
  );

  const url = new URL(capturedUrl);
  assert.equal(url.origin + url.pathname, "https://api.search.brave.com/res/v1/llm/context");
  assert.equal(url.searchParams.get("q"), "B2B SaaS pain points");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    "X-Subscription-Token": "test-key",
  });
  assert.deepEqual(result, {
    query: "B2B SaaS pain points",
    results: [
      { url: "https://example.com/a", title: "Page A", snippets: ["Snippet one."] },
      { url: "https://example.com/b", title: "Page B", snippets: ["Snippet two."] },
    ],
  });
});

test("fetchLlmContext sends both count and maximum_number_of_urls params", async () => {
  let capturedUrl = "";

  await fetchLlmContext(
    { query: "relay", count: 7 },
    {
      env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async (input) => {
        capturedUrl = input;
        return makeBraveResponse([]);
      },
    },
  );

  const url = new URL(capturedUrl);
  assert.equal(url.searchParams.get("count"), "7");
  assert.equal(url.searchParams.get("maximum_number_of_urls"), "7");
});

test("fetchLlmContext drops results with empty snippets", async () => {
  const result = await fetchLlmContext(
    { query: "relay" },
    {
      env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () =>
        makeBraveResponse([
          { url: "https://example.com/a", title: "Has Snippets", snippets: ["content"] },
          { url: "https://example.com/b", title: "No Snippets", snippets: [] },
        ]),
    },
  );

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].url, "https://example.com/a");
});

test("fetchLlmContext normalizes snippet HTML entities and tags", async () => {
  const result = await fetchLlmContext(
    { query: "relay" },
    {
      env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () =>
        makeBraveResponse([
          {
            url: "https://example.com/a",
            title: "Page",
            snippets: ["Sales &amp; <strong>Marketing</strong> pain points"],
          },
        ]),
    },
  );

  assert.equal(result.results[0].snippets[0], "Sales & Marketing pain points");
});

test("fetchLlmContext throws BraveContextError on 401", async () => {
  await assert.rejects(
    fetchLlmContext(
      { query: "relay" },
      {
        env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          headers: { get: () => null },
          async text() {
            return "Unauthorized";
          },
          async json() {
            return {};
          },
        }),
      },
    ),
    (err: unknown) => err instanceof BraveContextError && err.status === 401,
  );
});

test("fetchLlmContext throws BraveContextError on 403", async () => {
  await assert.rejects(
    fetchLlmContext(
      { query: "relay" },
      {
        env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          headers: { get: () => null },
          async text() {
            return "Forbidden";
          },
          async json() {
            return {};
          },
        }),
      },
    ),
    (err: unknown) => err instanceof BraveContextError && err.status === 403,
  );
});

test("fetchLlmContext attaches retryAfterMs on 429 with Retry-After header", async () => {
  let caughtError: BraveContextError | undefined;
  try {
    await fetchLlmContext(
      { query: "relay" },
      {
        env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 429,
          headers: { get: (name: string) => (name === "retry-after" ? "30" : null) },
          async text() {
            return "Too Many Requests";
          },
          async json() {
            return {};
          },
        }),
      },
    );
  } catch (err) {
    if (err instanceof BraveContextError) caughtError = err;
  }

  assert.ok(caughtError instanceof BraveContextError);
  assert.equal(caughtError.status, 429);
  assert.equal(caughtError.retryAfterMs, 30000);
});

test("fetchLlmContext rejects before fetching when BRAVE_API_KEY is missing", async () => {
  await assert.rejects(
    fetchLlmContext(
      { query: "relay" },
      {
        env: {} as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run");
        },
      },
    ),
    /Missing BRAVE_API_KEY/,
  );
});

test("fetchLlmContext rejects invalid count input with ZodError", async () => {
  await assert.rejects(
    fetchLlmContext(
      { query: "relay", count: 0 },
      {
        env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run");
        },
      },
    ),
    z.ZodError,
  );
});

test("fetchLlmContext rejects empty query with ZodError", async () => {
  await assert.rejects(
    fetchLlmContext(
      { query: "" },
      {
        env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run");
        },
      },
    ),
    z.ZodError,
  );
});

test("fetchLlmContext throws BraveResponseParseError when grounding key is missing", async () => {
  await assert.rejects(
    fetchLlmContext(
      { query: "relay" },
      {
        env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          headers: { get: () => null },
          async text() {
            return "";
          },
          async json() {
            return { unexpected: "shape" };
          },
        }),
      },
    ),
    BraveResponseParseError,
  );
});

test("webFetchLlmTool.onError maps input ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small",
    minimum: 1,
    inclusive: true,
    origin: "string",
    path: ["query"],
    message: "String must contain at least 1 character(s)",
  }]);

  assert.deepEqual(webFetchLlmTool.onError?.(error), {
    type: "validation",
    message: "String must contain at least 1 character(s)",
  });
});

test("webFetchLlmTool.onError maps BraveResponseParseError to external_error", () => {
  assert.deepEqual(webFetchLlmTool.onError?.(new BraveResponseParseError()), {
    type: "external_error",
    message: "Unexpected Brave response shape",
  });
});

test("webFetchLlmTool.onError maps 401/403 to auth_error", () => {
  assert.deepEqual(webFetchLlmTool.onError?.(new BraveContextError(401, "Unauthorized")), {
    type: "auth_error",
    message: "Unauthorized",
  });
  assert.deepEqual(webFetchLlmTool.onError?.(new BraveContextError(403, "Forbidden")), {
    type: "auth_error",
    message: "Forbidden",
  });
});

test("webFetchLlmTool.onError maps 429 to rate_limit_error with retryAfterMs", () => {
  const result = webFetchLlmTool.onError?.(
    new BraveContextError(429, "Too Many Requests", 30000),
  ) as ({ type: string; message?: string; retryAfterMs?: number }) | undefined;
  assert.equal(result?.type, "rate_limit_error");
  assert.equal(result?.message, "Too Many Requests");
  assert.equal(result?.retryAfterMs, 30000);
});
