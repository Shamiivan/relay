/**
 * Preloaded by subprocess integration tests to validate the request boundary
 * without touching the real Apollo API.
 */
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);
  const body = JSON.parse(String(init?.body ?? "{}"));

  if (url.pathname !== "/api/v1/mixed_companies/search") {
    throw new Error(`Unexpected Apollo path: ${url.pathname}`);
  }
  if (body.q_keywords !== process.env.EXPECTED_APOLLO_COMPANY_KEYWORDS) {
    throw new Error(`Unexpected Apollo keywords: ${body.q_keywords}`);
  }
  if (String(body.page) !== process.env.EXPECTED_APOLLO_COMPANY_PAGE) {
    throw new Error(`Unexpected Apollo page: ${body.page}`);
  }
  if (String(body.per_page) !== process.env.EXPECTED_APOLLO_COMPANY_PER_PAGE) {
    throw new Error(`Unexpected Apollo per_page: ${body.per_page}`);
  }
  if (headers.get("X-Api-Key") !== process.env.APOLLO_API_KEY) {
    throw new Error("Unexpected Apollo API key");
  }

  return {
    ok: true,
    status: 200,
    headers: { get() { return null; } },
    async text() {
      return "";
    },
    async json() {
      return {
        organizations: [
          {
            id: "org-1",
            name: "Example Corp",
            primary_domain: "example.com",
            industry: "Software",
            estimated_num_employees: 57,
          },
        ],
        total_entries: 3,
      };
    },
  };
};
