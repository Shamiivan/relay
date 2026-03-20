import { z } from "zod";
import { loadDotenv } from "../../../packages/env/src/index.ts";
import { InstantlyApiError, InstantlyResponseParseError } from "./errors.ts";

const INSTANTLY_API_BASE_URL = "https://api.instantly.ai/api/v2/";

loadDotenv();

export type InstantlyFetch = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export type InstantlyQueryValue = string | number | boolean | Array<string | number>;

export function getInstantlyApiKey(env: NodeJS.ProcessEnv = process.env): string {
  loadDotenv();
  const apiKey = env.INSTANTLY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing INSTANTLY_API_KEY");
  }
  return apiKey;
}

export function getInstantlyBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.INSTANTLY_API_BASE_URL?.trim() || INSTANTLY_API_BASE_URL;
}

function appendQuery(url: URL, query: Record<string, InstantlyQueryValue | undefined>): void {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      url.searchParams.set(key, value.join(","));
      continue;
    }
    url.searchParams.set(key, String(value));
  }
}

export async function instantlyRequest<TSchema extends z.ZodType>(
  input: {
    path: string;
    responseSchema: TSchema;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    query?: Record<string, InstantlyQueryValue | undefined>;
    body?: unknown;
  },
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: InstantlyFetch;
  },
): Promise<z.output<TSchema>> {
  const env = options?.env ?? process.env;
  const fetchImpl = options?.fetchImpl ?? (globalThis.fetch as InstantlyFetch | undefined);
  const apiKey = getInstantlyApiKey(env);
  const baseUrl = getInstantlyBaseUrl(env);

  if (!fetchImpl) {
    throw new Error("Fetch is not available in this runtime");
  }

  const url = new URL(input.path.replace(/^\//, ""), baseUrl);
  appendQuery(url, input.query ?? {});

  const response = await fetchImpl(url.toString(), {
    method: input.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${apiKey}`,
    },
    ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
  });

  if (!response.ok) {
    const message = (await response.text()).trim()
      || `Instantly API returned HTTP ${response.status}`;
    throw new InstantlyApiError(response.status, message);
  }

  try {
    return input.responseSchema.parse(await response.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new InstantlyResponseParseError();
    }
    throw error;
  }
}
