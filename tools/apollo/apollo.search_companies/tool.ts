import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../sdk";
import type { ToolErrorInfo } from "../../sdk";
import { apolloRequest, type ApolloFetch } from "../lib/client.ts";
import { ApolloApiError, ApolloResponseParseError } from "../lib/errors.ts";

const inputSchema = z.object({
  page: z.number().int().min(1).max(500).default(1).describe(
    "1-based Apollo result page to fetch.",
  ),
  perPage: z.number().int().min(1).max(100).default(25).describe(
    "Maximum companies to return per page, between 1 and 100.",
  ),
  keywords: z.string().min(1).optional().describe(
    "Free-text keywords to match against companies.",
  ),
  industries: z.array(z.string().min(1)).max(20).optional().describe(
    "Deprecated free-text industry hints. Use industryTagIds for real Apollo industry filtering.",
  ),
  industryTagIds: z.array(z.string().min(1)).max(50).optional().describe(
    "Apollo industry tag IDs for precise industry filtering.",
  ),
  locations: z.array(z.string().min(1)).max(20).optional().describe(
    "Company headquarters locations such as cities, regions, or countries.",
  ),
  employeeCountMin: z.number().int().min(1).max(1000000).optional().describe(
    "Minimum employee count for organization size filtering.",
  ),
  employeeCountMax: z.number().int().min(1).max(1000000).optional().describe(
    "Maximum employee count for organization size filtering.",
  ),
  organizationDomains: z.array(z.string().min(1)).max(100).optional().describe(
    "Optional domain filter when the target account list is already partially known.",
  ),
  body: z.object({}).passthrough().optional().describe(
    "Additional native Apollo mixed_companies/search request fields for advanced tuning.",
  ),
}).superRefine((value, ctx) => {
  if (
    value.employeeCountMin !== undefined
    && value.employeeCountMax !== undefined
    && value.employeeCountMin > value.employeeCountMax
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "employeeCountMin must be less than or equal to employeeCountMax",
      path: ["employeeCountMin"],
    });
  }

  if ((value.industries?.length ?? 0) > 0 && (value.industryTagIds?.length ?? 0) === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "industries is not a precise Apollo filter; use industryTagIds instead",
      path: ["industries"],
    });
  }
});

const companySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  primary_domain: z.string().nullable().optional(),
  website_url: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  estimated_num_employees: z.number().int().nullable().optional(),
});

const responseSchema = z.object({
  organizations: z.array(companySchema).default([]),
  total_entries: z.number().int().nonnegative().optional(),
  pagination: z.object({
    total_entries: z.number().int().nonnegative(),
  }).optional(),
});

const outputCompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  industry: z.string().nullable(),
  estimatedEmployeeCount: z.number().int().nullable(),
});

export type ApolloSearchCompaniesInput = z.input<typeof inputSchema>;

function toEmployeeRanges(input: z.output<typeof inputSchema>): string[] | undefined {
  if (input.employeeCountMin === undefined && input.employeeCountMax === undefined) {
    return undefined;
  }
  const min = input.employeeCountMin ?? 1;
  const max = input.employeeCountMax ?? 1000000;
  return [`${min},${max}`];
}

function combineKeywords(input: z.output<typeof inputSchema>): string | undefined {
  const value = input.keywords?.trim();
  if (!value) {
    return undefined;
  }
  return value;
}

function normalizeDomain(company: z.output<typeof companySchema>): string | null {
  const candidate = company.primary_domain ?? company.website_url ?? null;
  if (!candidate) {
    return null;
  }

  try {
    const url = candidate.includes("://") ? new URL(candidate) : new URL(`https://${candidate}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return candidate.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

export async function searchApolloCompanies(
  rawInput: ApolloSearchCompaniesInput,
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: ApolloFetch;
  },
): Promise<{
  companies: Array<z.output<typeof outputCompanySchema>>;
  totalCount: number;
  hasMore: boolean;
}> {
  const input = inputSchema.parse(rawInput);
  const payload = await apolloRequest(
    {
      path: "/mixed_companies/search",
      body: {
        ...(input.body ?? {}),
        page: input.page,
        per_page: input.perPage,
        q_keywords: combineKeywords(input),
        organization_locations: input.locations,
        organization_num_employees_ranges: toEmployeeRanges(input),
        organization_industry_tag_ids: input.industryTagIds,
        organization_domains: input.organizationDomains,
      },
      responseSchema,
    },
    options,
  );

  return {
    companies: payload.organizations.flatMap((company) => {
      if (!company.name) {
        return [];
      }
      return [{
        id: company.id,
        name: company.name,
        domain: normalizeDomain(company),
        industry: company.industry ?? null,
        estimatedEmployeeCount: company.estimated_num_employees ?? null,
      }];
    }),
    totalCount: payload.total_entries ?? payload.pagination?.total_entries ?? 0,
    hasMore: input.page * input.perPage < (payload.total_entries ?? payload.pagination?.total_entries ?? 0),
  };
}

export const apolloSearchCompaniesTool = defineTool({
  name: "apollo.search_companies",
  resource: "apollo.company",
  capability: "search",
  description: "Search Apollo companies with ICP filters and return normalized organization records.",
  idempotent: true,
  input: inputSchema,
  output: z.object({
    companies: z.array(outputCompanySchema).default([]),
    totalCount: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return searchApolloCompanies(input);
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
      message: error instanceof Error ? error.message : "Unknown Apollo company search error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(apolloSearchCompaniesTool);
}
