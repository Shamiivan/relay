import { z } from "zod";
import { loadDotenv } from "../../../packages/env/src/index.ts";
import { ApolloApiError, ApolloResponseParseError } from "./errors.ts";

const APOLLO_API_BASE_URL = "https://api.apollo.io/api/v1/";

loadDotenv();

export type ApolloFetch = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

function getApolloApiKey(env: NodeJS.ProcessEnv = process.env): string {
  loadDotenv();
  const apiKey = env.APOLLO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing APOLLO_API_KEY");
  }
  return apiKey;
}

function getApolloBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.APOLLO_API_BASE_URL?.trim() || APOLLO_API_BASE_URL;
}

export async function apolloRequest<TSchema extends z.ZodType>(
  input: {
    path: string;
    responseSchema: TSchema;
    method?: "GET" | "POST";
    body?: unknown;
  },
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: ApolloFetch;
  },
): Promise<z.output<TSchema>> {
  const env = options?.env ?? process.env;
  const fetchImpl = options?.fetchImpl ?? (globalThis.fetch as ApolloFetch | undefined);
  const apiKey = getApolloApiKey(env);
  const baseUrl = getApolloBaseUrl(env);

  if (!fetchImpl) {
    throw new Error("Fetch is not available in this runtime");
  }

  const url = new URL(input.path.replace(/^\//, ""), baseUrl);
  const response = await fetchImpl(url.toString(), {
    method: input.method ?? "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(input.body ?? {}),
  });

  if (!response.ok) {
    const message = (await response.text()).trim()
      || `Apollo API returned HTTP ${response.status}`;
    throw new ApolloApiError(response.status, message);
  }

  try {
    return input.responseSchema.parse(await response.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApolloResponseParseError();
    }
    throw error;
  }
}
