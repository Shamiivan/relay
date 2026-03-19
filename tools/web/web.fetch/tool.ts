import { z } from "zod";
import { loadDotenv } from "../../../packages/env/src/index.ts";
import { defineTool, promptFile, runDeclaredTool } from "../../sdk";
import type { ToolErrorInfo } from "../../sdk";

loadDotenv();

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
];

const MAX_BODY_BYTES = 2_000_000;

const inputSchema = z.object({
  url: z.string().url().describe("The https:// URL to fetch and return as plain text."),
  maxChars: z.number().int().min(1000).max(50000).default(20000)
    .describe(
      "Maximum characters of content to return. Content is truncated at a paragraph boundary.",
    ),
});

export type FetchUrlInput = z.input<typeof inputSchema>;

export type WebFetchResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type WebFetchFetch = (
  input: string,
  init?: RequestInit,
) => Promise<WebFetchResponse>;

export class FetchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchValidationError";
  }
}

export class FetchNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchNotFoundError";
  }
}

export class FetchExternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchExternalError";
  }
}

function isPrivateHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "[::1]") {
    return true;
  }
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

function validateUrl(rawUrl: string): void {
  if (!rawUrl.startsWith("https://")) {
    throw new FetchValidationError("Only https:// URLs are supported");
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new FetchValidationError("Invalid URL");
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new FetchValidationError("Private URLs are not allowed");
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function extractText(html: string): string {
  // Remove entire subtrees for noise elements
  let result = html.replace(
    /<(script|style|noscript|svg|nav|footer|aside|header)[\s\S]*?<\/\1>/gi,
    " ",
  );
  // Strip remaining tags
  result = result.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(result)
    .replace(/\s+/g, " ")
    .trim();
}

function truncateAtParagraph(
  text: string,
  maxChars: number,
): { content: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { content: text, truncated: false };
  }
  const sub = text.slice(0, maxChars);
  const lastNewline = sub.lastIndexOf("\n");
  const cut = lastNewline > 0 ? lastNewline : maxChars;
  return { content: text.slice(0, cut).trimEnd(), truncated: true };
}

export async function fetchUrl(
  rawInput: FetchUrlInput,
  options?: { fetchImpl?: WebFetchFetch },
): Promise<{ url: string; title: string; content: string; truncated: boolean }> {
  const input = inputSchema.parse(rawInput);
  validateUrl(input.url);

  const fetchImpl = options?.fetchImpl
    ?? (globalThis.fetch as unknown as WebFetchFetch | undefined);
  if (!fetchImpl) {
    throw new Error("Fetch is not available in this runtime");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response: WebFetchResponse;
  try {
    response = await fetchImpl(input.url, {
      method: "GET",
      headers: { Accept: "text/html, text/plain" },
      signal: controller.signal as RequestInit["signal"],
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : "Network error";
    throw new FetchExternalError(msg);
  }
  clearTimeout(timeoutId);

  if (response.status === 404) {
    throw new FetchNotFoundError(`Not found: ${input.url}`);
  }
  if (!response.ok) {
    throw new FetchExternalError(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    const bare = contentType.split(";")[0].trim();
    throw new FetchExternalError(`Unexpected content type: ${bare}`);
  }

  let html = await response.text();
  if (html.length > MAX_BODY_BYTES) {
    html = html.slice(0, MAX_BODY_BYTES);
  }

  const title = extractTitle(html);
  const rawText = extractText(html);
  const { content, truncated } = truncateAtParagraph(rawText, input.maxChars);

  return { url: input.url, title, content, truncated };
}

export const webFetchTool = defineTool({
  name: "web.fetch",
  resource: "web",
  capability: "read",
  description:
    "Fetch a URL and return its full content as clean plain text. Best for reading a specific page in full.",
  idempotent: true,
  input: inputSchema,
  output: z.object({
    url: z.string(),
    title: z.string(),
    content: z.string(),
    truncated: z.boolean(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return fetchUrl(input);
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof FetchValidationError) {
      return { type: "validation", message: error.message };
    }
    if (error instanceof FetchNotFoundError) {
      return { type: "not_found", message: error.message };
    }
    if (error instanceof FetchExternalError) {
      return { type: "external_error", message: error.message };
    }
    return {
      type: "external_error",
      message: error instanceof Error ? error.message : "Unknown fetch error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(webFetchTool);
}
