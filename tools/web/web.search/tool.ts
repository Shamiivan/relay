import { z } from "zod";
import { loadDotenv } from "../../../packages/env/src/index.ts";
import { defineTool, promptFile, runDeclaredTool } from "../../sdk";
import type { ToolErrorInfo } from "../../sdk";

const BRAVE_WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

loadDotenv();

const inputSchema = z.object({
  query: z.string().min(1).describe("The web search query to run."),
  count: z.number().int().min(1).max(20).default(5).describe(
    "Maximum number of results to return, between 1 and 20.",
  ),
  offset: z.number().int().min(0).max(9).default(0).describe(
    "Pagination offset. Brave documents this as 0-based and allows a maximum of 9.",
  ),
});

const resultSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string(),
});

const responseSchema = z.object({
  query: z.object({
    original: z.string().optional(),
    more_results_available: z.boolean().optional(),
  }).default({}),
  web: z.object({
    results: z.array(z.object({
      title: z.string().optional(),
      url: z.string().optional(),
      description: z.string().optional(),
    })).default([]),
  }).default({ results: [] }),
});

export type WebSearchInput = z.input<typeof inputSchema>;
export type WebSearchResult = z.output<typeof resultSchema>;

export class BraveSearchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BraveSearchError";
    this.status = status;
  }
}

export type WebSearchFetch = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
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

function buildWebSearchUrl(input: z.output<typeof inputSchema>): string {
  const url = new URL(BRAVE_WEB_SEARCH_URL);
  url.searchParams.set("q", input.query);
  url.searchParams.set("count", String(input.count));
  url.searchParams.set("offset", String(input.offset));
  return url.toString();
}

function normalizeResults(payload: z.output<typeof responseSchema>): WebSearchResult[] {
  return payload.web.results.flatMap((result) => {
    if (!result.title || !result.url || !result.description) {
      return [];
    }
    return [{
      title: result.title,
      url: result.url,
      description: result.description,
    }];
  });
}

export async function searchWeb(
  rawInput: WebSearchInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: WebSearchFetch;
  },
): Promise<{
  results: WebSearchResult[];
  total: number;
  query: string;
  moreResultsAvailable: boolean;
}> {
  const input = inputSchema.parse(rawInput);
  const apiKey = getBraveApiKey(options?.env);
  const fetchImpl = options?.fetchImpl ?? (globalThis.fetch as WebSearchFetch | undefined);

  if (!fetchImpl) {
    throw new Error("Fetch is not available in this runtime");
  }

  const response = await fetchImpl(buildWebSearchUrl(input), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    const message = (await response.text()).trim() || `Brave Search returned HTTP ${response.status}`;
    throw new BraveSearchError(response.status, message);
  }

  const payload = responseSchema.parse(await response.json());
  const results = normalizeResults(payload);

  return {
    results,
    total: results.length,
    query: payload.query.original ?? input.query,
    moreResultsAvailable: payload.query.more_results_available ?? false,
  };
}

export const webSearchTool = defineTool({
  name: "web.search",
  resource: "web",
  capability: "search",
  description: "Search the public web with Brave Search and return result titles, URLs, and snippets.",
  idempotent: true,
  input: inputSchema,
  output: z.object({
    results: z.array(resultSchema).default([]),
    total: z.number().int().nonnegative(),
    query: z.string(),
    moreResultsAvailable: z.boolean(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return searchWeb(input);
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof BraveSearchError) {
      if (error.status === 401 || error.status === 403) {
        return { type: "auth_error", message: error.message };
      }
      if (error.status === 429) {
        return { type: "rate_limit_error", message: error.message };
      }
      return { type: "external_error", message: error.message };
    }
    if (error instanceof Error && /BRAVE_API_KEY|auth|credential|token/i.test(error.message)) {
      return { type: "auth_error", message: error.message };
    }
    return { type: "external_error", message: error instanceof Error ? error.message : "Unknown web search error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(webSearchTool);
}
