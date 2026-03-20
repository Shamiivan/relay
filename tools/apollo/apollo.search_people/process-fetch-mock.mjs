/**
 * Preloaded by subprocess integration tests to validate the request boundary
 * without touching the real Apollo API.
 */
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);
  const body = JSON.parse(String(init?.body ?? "{}"));

  if (url.pathname !== "/api/v1/mixed_people/api_search") {
    throw new Error(`Unexpected Apollo path: ${url.pathname}`);
  }
  if (String(body.organization_ids?.[0]) !== process.env.EXPECTED_APOLLO_ORG_ID) {
    throw new Error(`Unexpected Apollo organization_ids: ${body.organization_ids}`);
  }
  if (String(body.per_page) !== process.env.EXPECTED_APOLLO_PEOPLE_PER_PAGE) {
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
        people: [
          {
            id: "person-1",
            first_name: "Taylor",
            last_name: "Smith",
            title: "VP Sales",
            has_email: true,
            organization: {
              id: process.env.EXPECTED_APOLLO_ORG_ID,
              name: "Example Corp",
            },
          },
        ],
        total_entries: 2,
      };
    },
  };
};
