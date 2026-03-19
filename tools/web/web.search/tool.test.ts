import assert from "node:assert/strict";
import test from "node:test";
import { BraveSearchError, searchWeb, webSearchTool } from "./tool.ts";

test("searchWeb maps Brave web results into the tool output shape", async () => {
  let capturedUrl = "";
  let capturedHeaders: HeadersInit | undefined;

  const result = await searchWeb(
    { query: "B2B SaaS pain points", count: 2, offset: 1 },
    {
      env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async (input, init) => {
        capturedUrl = input;
        capturedHeaders = init?.headers;
        return {
          ok: true,
          status: 200,
          async text() {
            return "";
          },
          async json() {
            return {
              query: {
                original: "B2B SaaS pain points",
                more_results_available: true,
              },
              web: {
                results: [
                  {
                    title: "Pain Points",
                    url: "https://example.com/pain-points",
                    description: "Common B2B SaaS pain points.",
                  },
                  {
                    title: "Messaging",
                    url: "https://example.com/messaging",
                    description: "How buyers describe the problem.",
                  },
                ],
              },
            };
          },
        };
      },
    },
  );

  const url = new URL(capturedUrl);
  assert.equal(url.origin + url.pathname, "https://api.search.brave.com/res/v1/web/search");
  assert.equal(url.searchParams.get("q"), "B2B SaaS pain points");
  assert.equal(url.searchParams.get("count"), "2");
  assert.equal(url.searchParams.get("offset"), "1");
  assert.deepEqual(capturedHeaders, {
    Accept: "application/json",
    "X-Subscription-Token": "test-key",
  });
  assert.deepEqual(result, {
    results: [
      {
        title: "Pain Points",
        url: "https://example.com/pain-points",
        description: "Common B2B SaaS pain points.",
      },
      {
        title: "Messaging",
        url: "https://example.com/messaging",
        description: "How buyers describe the problem.",
      },
    ],
    total: 2,
    query: "B2B SaaS pain points",
    moreResultsAvailable: true,
  });
});

test("searchWeb drops incomplete results instead of returning partial objects", async () => {
  const result = await searchWeb(
    { query: "relay", count: 3 },
    {
      env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async text() {
          return "";
        },
        async json() {
          return {
            web: {
              results: [
                {
                  title: "Complete",
                  url: "https://example.com/complete",
                  description: "Complete result.",
                },
                {
                  title: "Missing description",
                  url: "https://example.com/incomplete",
                },
              ],
            },
          };
        },
      }),
    },
  );

  assert.deepEqual(result.results, [{
    title: "Complete",
    url: "https://example.com/complete",
    description: "Complete result.",
  }]);
  assert.equal(result.total, 1);
  assert.equal(result.moreResultsAvailable, false);
});

test("searchWeb surfaces Brave auth and rate limit statuses distinctly", async () => {
  await assert.rejects(
    searchWeb(
      { query: "relay" },
      {
        env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          async text() {
            return "Unauthorized";
          },
          async json() {
            return {};
          },
        }),
      },
    ),
    (error: unknown) => error instanceof BraveSearchError && error.status === 401,
  );

  const authError = webSearchTool.onError?.(new BraveSearchError(401, "Unauthorized"));
  const rateLimitError = webSearchTool.onError?.(new BraveSearchError(429, "Too Many Requests"));

  assert.deepEqual(authError, {
    type: "auth_error",
    message: "Unauthorized",
  });
  assert.deepEqual(rateLimitError, {
    type: "rate_limit_error",
    message: "Too Many Requests",
  });
});

test("searchWeb fails clearly when BRAVE_API_KEY is missing", async () => {
  await assert.rejects(
    searchWeb(
      { query: "relay" },
      {
        env: {} as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run without credentials");
        },
      },
    ),
    /Missing BRAVE_API_KEY/,
  );
});
