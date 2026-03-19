import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { BraveSearchError, searchWeb, type WebSearchFetch, webSearchTool } from "./tool.ts";

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
  assert.equal(result.moreResultsAvailable, false);
});

test("searchWeb normalizes Brave snippet markup into plain text", async () => {
  const result = await searchWeb(
    { query: "relay" },
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
                  title: "Snippet",
                  url: "https://example.com/snippet",
                  description: "Sales &amp; Marketing <strong>pain-points</strong> for SaaS",
                },
              ],
            },
          };
        },
      }),
    },
  );

  assert.deepEqual(result.results, [{
    title: "Snippet",
    url: "https://example.com/snippet",
    description: "Sales & Marketing pain-points for SaaS",
  }]);
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

test("searchWeb fails clearly when fetch is not available", async () => {
  const originalFetch = globalThis.fetch;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).fetch;

    await assert.rejects(
      searchWeb(
        { query: "relay" },
        {
          env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        },
      ),
      /Fetch is not available in this runtime/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("searchWeb validates input before making a request", async () => {
  await assert.rejects(
    searchWeb(
      { query: "", count: 5 },
      {
        env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run for invalid input");
        },
      },
    ),
    z.ZodError,
  );

  await assert.rejects(
    searchWeb(
      { query: "relay", count: 25 },
      {
        env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
        fetchImpl: async () => {
          throw new Error("fetch should not run for invalid input");
        },
      },
    ),
    z.ZodError,
  );
});

test("webSearchTool.handler returns the normalized output shape", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return {
          query: {
            original: "relay agent",
            more_results_available: false,
          },
          web: {
            results: [
              {
                title: "Relay",
                url: "https://example.com/relay",
                description: "Relay &amp; agent <strong>workflow</strong>",
              },
            ],
          },
        };
      },
    })) as unknown as typeof fetch;

    const result = await webSearchTool.handler({
      input: {
        query: "relay agent",
        count: 1,
        offset: 0,
      },
    });

    assert.deepEqual(result, {
      results: [{
        title: "Relay",
        url: "https://example.com/relay",
        description: "Relay & agent workflow",
      }],
      query: "relay agent",
      moreResultsAvailable: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("webSearchTool.handler returns the normalized output shape with injected fetch", async () => {
  const fetchImpl: WebSearchFetch = async () => ({
    ok: true,
    status: 200,
    async text() {
      return "";
    },
    async json() {
      return {
        query: {
          original: "relay agent",
          more_results_available: false,
        },
        web: {
          results: [
            {
              title: "Relay",
              url: "https://example.com/relay",
              description: "Relay &amp; agent <strong>workflow</strong>",
            },
          ],
        },
      };
    },
  });

  const result = await searchWeb(
    {
      query: "relay agent",
      count: 1,
      offset: 0,
    },
    {
      env: { BRAVE_API_KEY: "test-key" } as NodeJS.ProcessEnv,
      fetchImpl,
    },
  );

  assert.deepEqual(result, {
    results: [{
      title: "Relay",
      url: "https://example.com/relay",
      description: "Relay & agent workflow",
    }],
    query: "relay agent",
    moreResultsAvailable: false,
  });
});

test("webSearchTool.onError maps validation errors to the stable contract", () => {
  const error = new z.ZodError([{
    code: "too_small",
    minimum: 1,
    inclusive: true,
    origin: "string",
    path: ["query"],
    message: "Too small: expected string to have >=1 characters",
  }]);

  assert.deepEqual(webSearchTool.onError?.(error), {
    type: "validation",
    message: "Too small: expected string to have >=1 characters",
  });
});

test("webSearchTool.onError maps auth-like plain errors to auth_error", () => {
  assert.deepEqual(
    webSearchTool.onError?.(new Error("Missing auth credential")),
    {
      type: "auth_error",
      message: "Missing auth credential",
    },
  );
});

test("webSearchTool.onError maps unknown errors to external_error", () => {
  assert.deepEqual(
    webSearchTool.onError?.(new Error("socket hang up")),
    {
      type: "external_error",
      message: "socket hang up",
    },
  );
});
