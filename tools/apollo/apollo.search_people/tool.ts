import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../sdk";
import type { ToolErrorInfo } from "../../sdk";
import { apolloRequest, type ApolloFetch } from "../lib/client.ts";
import { ApolloApiError, ApolloResponseParseError } from "../lib/errors.ts";

const inputSchema = z.object({
  organizationIds: z.array(z.string().min(1)).min(1).max(100).describe(
    "Apollo organization IDs to scope the people search to.",
  ),
  titles: z.array(z.string().min(1)).max(50).optional().describe(
    "Job titles to filter on, such as VP Sales or Head of Growth.",
  ),
  personLocations: z.array(z.string().min(1)).max(20).optional().describe(
    "Optional person-level locations such as California, US.",
  ),
  keywords: z.string().min(1).optional().describe(
    "Optional free-text keyword query for Apollo people search.",
  ),
  page: z.number().int().min(1).max(500).default(1).describe(
    "1-based Apollo result page to fetch.",
  ),
  perPage: z.number().int().min(1).max(100).default(25).describe(
    "Maximum people to return per page, between 1 and 100.",
  ),
});

const personSchema = z.object({
  id: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  last_name_obfuscated: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  has_email: z.boolean().nullable().optional(),
  organization: z.object({
    id: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
  }).nullable().optional(),
});

const responseSchema = z.object({
  people: z.array(personSchema).default([]),
  total_entries: z.number().int().nonnegative(),
});

const outputPersonSchema = z.object({
  id: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  title: z.string().nullable(),
  organizationId: z.string().nullable(),
  organizationName: z.string().nullable(),
  hasEmail: z.boolean().nullable(),
});

export type ApolloSearchPeopleInput = z.input<typeof inputSchema>;

export async function searchApolloPeople(
  rawInput: ApolloSearchPeopleInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: ApolloFetch;
  },
): Promise<{
  people: Array<z.output<typeof outputPersonSchema>>;
  totalCount: number;
  hasMore: boolean;
}> {
  const input = inputSchema.parse(rawInput);
  const payload = await apolloRequest(
    {
      path: "/mixed_people/api_search",
      body: {
        organization_ids: input.organizationIds,
        person_titles: input.titles,
        person_locations: input.personLocations,
        q_keywords: input.keywords,
        page: input.page,
        per_page: input.perPage,
      },
      responseSchema,
    },
    options,
  );

  return {
    people: payload.people.map((person) => ({
      id: person.id,
      firstName: person.first_name ?? null,
      lastName: person.last_name ?? person.last_name_obfuscated ?? null,
      title: person.title ?? null,
      organizationId: person.organization?.id ?? null,
      organizationName: person.organization?.name ?? null,
      hasEmail: person.has_email ?? null,
    })),
    totalCount: payload.total_entries,
    hasMore: input.page * input.perPage < payload.total_entries,
  };
}

export const apolloSearchPeopleTool = defineTool({
  name: "apollo.search_people",
  resource: "apollo.person",
  capability: "search",
  description: "Search Apollo people within a known organization scope and return normalized prospect records.",
  idempotent: true,
  input: inputSchema,
  output: z.object({
    people: z.array(outputPersonSchema).default([]),
    totalCount: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return searchApolloPeople(input);
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof ApolloResponseParseError) {
      return { type: "external_error", message: error.message };
    }
    if (error instanceof ApolloApiError) {
      if (error.status === 401 || error.status === 403) {
        return { type: "auth_error", message: error.message };
      }
      if (error.status === 404) {
        return { type: "not_found", message: error.message };
      }
      if (error.status === 429) {
        return { type: "rate_limit_error", message: error.message };
      }
      return { type: "external_error", message: error.message };
    }
    if (error instanceof Error && /APOLLO_API_KEY|auth|credential|token/i.test(error.message)) {
      return { type: "auth_error", message: error.message };
    }
    return {
      type: "external_error",
      message: error instanceof Error ? error.message : "Unknown Apollo people search error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(apolloSearchPeopleTool);
}
