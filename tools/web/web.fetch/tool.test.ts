import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  FetchExternalError,
  FetchNotFoundError,
  FetchValidationError,
  fetchUrl,
  type WebFetchFetch,
  webFetchTool,
} from "./tool.ts";

function makeOkResponse(
  body: string,
  contentType = "text/html; charset=utf-8",
): Awaited<ReturnType<WebFetchFetch>> {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null) },
    async text() {
      return body;
    },
  };
}

test("fetchUrl extracts title, strips HTML, decodes entities", async () => {
  const result = await fetchUrl(
    { url: "https://example.com/page" },
    {
      fetchImpl: async () =>
        makeOkResponse(
          `<html><head><title>Hello &amp; World</title></head>` +
            `<body><p>Plain <strong>text</strong> here &lt;tag&gt;</p></body></html>`,
        ),
    },
  );

  assert.equal(result.url, "https://example.com/page");
  assert.equal(result.title, "Hello & World");
  assert.equal(result.truncated, false);
  assert.ok(result.content.includes("Plain"));
  assert.ok(result.content.includes("<tag>"));
  assert.ok(!result.content.includes("<strong>"));
  assert.ok(!result.content.includes("&lt;"));
});

test("fetchUrl removes <script>, <style>, <nav> subtrees from content", async () => {
  const result = await fetchUrl(
    { url: "https://example.com/page" },
    {
      fetchImpl: async () =>
        makeOkResponse(
          `<html><head><style>.foo{color:red}</style></head><body>` +
            `<nav><a href="/">Home</a></nav>` +
            `<script>alert("xss")</script>` +
            `<p>Actual content here.</p>` +
            `<footer>Copyright 2024</footer>` +
            `</body></html>`,
        ),
    },
  );

  assert.ok(!result.content.includes("color:red"), "style removed");
  assert.ok(!result.content.includes("alert"), "script removed");
  assert.ok(!result.content.includes("Copyright"), "footer removed");
  assert.ok(result.content.includes("Actual content here."), "body kept");
});

test("fetchUrl truncates at maxChars and sets truncated: true", async () => {
  const longParagraph = "x".repeat(5000);
  const body =
    `<html><body><p>${longParagraph}</p><p>${longParagraph}</p><p>${longParagraph}</p></body></html>`;

  const result = await fetchUrl(
    { url: "https://example.com/page", maxChars: 3000 },
    { fetchImpl: async () => makeOkResponse(body) },
  );

  assert.equal(result.truncated, true);
  assert.ok(result.content.length <= 3000, `content.length=${result.content.length} should be ≤ 3000`);
});

test("fetchUrl does not truncate when content fits within maxChars", async () => {
  const result = await fetchUrl(
    { url: "https://example.com/page", maxChars: 20000 },
    {
      fetchImpl: async () =>
        makeOkResponse("<html><body><p>Short page.</p></body></html>"),
    },
  );

  assert.equal(result.truncated, false);
  assert.ok(result.content.includes("Short page."));
});

test("fetchUrl rejects non-https URL before calling fetch", async () => {
  let fetchCalled = false;
  await assert.rejects(
    fetchUrl(
      { url: "http://example.com/page" },
      {
        fetchImpl: async () => {
          fetchCalled = true;
          return makeOkResponse("");
        },
      },
    ),
    FetchValidationError,
  );
  assert.equal(fetchCalled, false, "fetch should not have been called");
});

test("fetchUrl rejects localhost URL before calling fetch", async () => {
  let fetchCalled = false;
  await assert.rejects(
    fetchUrl(
      { url: "https://localhost/secret" },
      {
        fetchImpl: async () => {
          fetchCalled = true;
          return makeOkResponse("");
        },
      },
    ),
    FetchValidationError,
  );
  assert.equal(fetchCalled, false, "fetch should not have been called");
});

test("fetchUrl rejects private IP URL before calling fetch", async () => {
  let fetchCalled = false;
  await assert.rejects(
    fetchUrl(
      { url: "https://192.168.1.1/admin" },
      {
        fetchImpl: async () => {
          fetchCalled = true;
          return makeOkResponse("");
        },
      },
    ),
    FetchValidationError,
  );
  assert.equal(fetchCalled, false, "fetch should not have been called");
});

test("fetchUrl maps 404 response to FetchNotFoundError", async () => {
  await assert.rejects(
    fetchUrl(
      { url: "https://example.com/missing" },
      {
        fetchImpl: async () => ({
          ok: false,
          status: 404,
          headers: { get: () => null },
          async text() {
            return "Not Found";
          },
        }),
      },
    ),
    FetchNotFoundError,
  );
});

test("fetchUrl rejects non-HTML content-type with FetchExternalError", async () => {
  await assert.rejects(
    fetchUrl(
      { url: "https://example.com/image.png" },
      {
        fetchImpl: async () => makeOkResponse("binary data", "image/png"),
      },
    ),
    (err: unknown) =>
      err instanceof FetchExternalError && /Unexpected content type/.test(err.message),
  );
});

test("fetchUrl wraps network errors as FetchExternalError", async () => {
  await assert.rejects(
    fetchUrl(
      { url: "https://example.com/page" },
      {
        fetchImpl: async () => {
          throw new Error("socket hang up");
        },
      },
    ),
    (err: unknown) =>
      err instanceof FetchExternalError && err.message.includes("socket hang up"),
  );
});

test("fetchUrl wraps AbortError (timeout) as FetchExternalError", async () => {
  await assert.rejects(
    fetchUrl(
      { url: "https://example.com/page" },
      {
        fetchImpl: async () => {
          const err = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
          throw err;
        },
      },
    ),
    FetchExternalError,
  );
});

test("fetchUrl returns empty title when page has no <title>", async () => {
  const result = await fetchUrl(
    { url: "https://example.com/page" },
    {
      fetchImpl: async () =>
        makeOkResponse("<html><body><p>No title here.</p></body></html>"),
    },
  );

  assert.equal(result.title, "");
  assert.ok(result.content.includes("No title here."));
});

test("webFetchTool.onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small",
    minimum: 1,
    inclusive: true,
    origin: "string",
    path: ["url"],
    message: "String must contain at least 1 character(s)",
  }]);

  assert.deepEqual(webFetchTool.onError?.(error), {
    type: "validation",
    message: "String must contain at least 1 character(s)",
  });
});

test("webFetchTool.onError maps FetchValidationError to validation", () => {
  assert.deepEqual(webFetchTool.onError?.(new FetchValidationError("Only https:// URLs are supported")), {
    type: "validation",
    message: "Only https:// URLs are supported",
  });
});

test("webFetchTool.onError maps FetchNotFoundError to not_found", () => {
  assert.deepEqual(webFetchTool.onError?.(new FetchNotFoundError("Not found: https://example.com/x")), {
    type: "not_found",
    message: "Not found: https://example.com/x",
  });
});

test("webFetchTool.onError maps FetchExternalError to external_error", () => {
  assert.deepEqual(webFetchTool.onError?.(new FetchExternalError("HTTP 503")), {
    type: "external_error",
    message: "HTTP 503",
  });
});
