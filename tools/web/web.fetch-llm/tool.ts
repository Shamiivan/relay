import { z } from "zod";
import { loadDotenv } from "../../../packages/env/src/index.ts";
import { defineTool, promptFile, runDeclaredTool } from "../../sdk";
import type { ToolErrorInfo } from "../../sdk";

const BRAVE_LLM_CONTEXT_URL = "https://api.search.brave.com/res/v1/llm/context";

loadDotenv();

const inputSchema = z.object({
  query: z.string().min(1).describe("Search query to fetch web content for."),
  count: z.number().int().min(1).max(20).default(5)
    .describe("Maximum number of URLs to retrieve content from."),
});

const genericResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  snippets: z.array(z.string()),
});

const braveContextResponseSchema = z.object({
  grounding: z.object({
    generic: z.array(genericResultSchema).default([]),
  }),
});

export type FetchLlmInput = z.input<typeof inputSchema>;

export class BraveContextError extends Error {
  status: number;
  retryAfterMs?: number;

  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message);
    this.name = "BraveContextError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export class BraveResponseParseError extends Error {
  constructor(message = "Unexpected Brave response shape") {
    super(message);
    this.name = "BraveResponseParseError";
  }
}

export type LlmContextFetch = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

function getBraveApiKey(env: NodeJS.ProcessEnv = process.env): string {
  loadDotenv();
  const apiKey = env.BRAVE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing BRAVE_API_KEY");
  }
  return apiKey;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function normalizeSnippet(value: string): string {
  return decodeHtmlEntities(stripHtmlTags(value))
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchLlmContext(
  rawInput: FetchLlmInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: LlmContextFetch;
  },
): Promise<{
  results: Array<{ url: string; title: string; snippets: string[] }>;
  query: string;
}> {
  const input = inputSchema.parse(rawInput);
  const env = options?.env ?? process.env;
  const apiKey = getBraveApiKey(env);
  const fetchImpl = options?.fetchImpl ?? (globalThis.fetch as LlmContextFetch | undefined);

  if (!fetchImpl) {
    throw new Error("Fetch is not available in this runtime");
  }

  const url = new URL(BRAVE_LLM_CONTEXT_URL);
  url.searchParams.set("q", input.query);
  url.searchParams.set("count", String(input.count));
  url.searchParams.set("maximum_number_of_urls", String(input.count));

  const response = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    let retryAfterMs: number | undefined;
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) {
        const seconds = Number(retryAfter);
        if (!Number.isNaN(seconds)) {
          retryAfterMs = seconds * 1000;
        }
      }
    }
    const message = (await response.text()).trim()
      || `Brave LLM Context returned HTTP ${response.status}`;
    throw new BraveContextError(response.status, message, retryAfterMs);
  }

  let payload: z.output<typeof braveContextResponseSchema>;
  try {
    payload = braveContextResponseSchema.parse(await response.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new BraveResponseParseError();
    }
    throw err;
  }

  const results = payload.grounding.generic
    .filter((item) => item.snippets.length > 0)
    .map((item) => ({
      url: item.url,
      title: item.title,
      snippets: item.snippets.map(normalizeSnippet),
    }));

  return { results, query: input.query };
}

export const webFetchLlmTool = defineTool({
  name: "web.fetch-llm",
  resource: "web",
  capability: "read",
  description:
    "Search the web and retrieve pre-ranked content chunks via Brave LLM Context API. Combines search and extraction in one call.",
  idempotent: true,
  input: inputSchema,
  output: z.object({
    results: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        snippets: z.array(z.string()),
      }),
    ).default([]),
    query: z.string(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return fetchLlmContext(input);
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof BraveResponseParseError) {
      return { type: "external_error", message: "Unexpected Brave response shape" };
    }
    if (error instanceof BraveContextError) {
      if (error.status === 401 || error.status === 403) {
        return { type: "auth_error", message: error.message };
      }
      if (error.status === 429) {
        const info: ToolErrorInfo = { type: "rate_limit_error", message: error.message };
        if (error.retryAfterMs !== undefined) {
          (info as ToolErrorInfo & { retryAfterMs?: number }).retryAfterMs = error.retryAfterMs;
        }
        return info;
      }
      return { type: "external_error", message: error.message };
    }
    if (error instanceof Error && /BRAVE_API_KEY|auth|credential|token/i.test(error.message)) {
      return { type: "auth_error", message: error.message };
    }
    return {
      type: "external_error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(webFetchLlmTool);
}
