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
  const expectedOrgId = process.env.EXPECTED_APOLLO_ORG_ID;
  const expectedKeywords = process.env.EXPECTED_APOLLO_PEOPLE_KEYWORDS;
  const expectedLocationsEnv = process.env.EXPECTED_APOLLO_PERSON_LOCATIONS;
  const expectedTitle = process.env.EXPECTED_APOLLO_PERSON_TITLE;

  if (expectedOrgId) {
    if (String(body.organization_ids?.[0]) !== expectedOrgId) {
      throw new Error(`Unexpected Apollo organization_ids: ${body.organization_ids}`);
    }
  } else if (expectedKeywords) {
    if (body.q_keywords !== expectedKeywords) {
      throw new Error(`Unexpected Apollo q_keywords: ${body.q_keywords}`);
    }
    if (expectedLocationsEnv) {
      const expectedLocations = expectedLocationsEnv.split("|");
      const actualLocations = body.person_locations ?? [];
      if (actualLocations.length !== expectedLocations.length
          || expectedLocations.some((loc, index) => loc !== actualLocations[index])) {
        throw new Error(`Unexpected Apollo person_locations: ${JSON.stringify(actualLocations)}`);
      }
    }
    if (expectedTitle) {
      if (body.person_titles?.[0] !== expectedTitle) {
        throw new Error(`Unexpected Apollo person_titles: ${body.person_titles}`);
      }
    }
  }
  if (String(body.per_page) !== process.env.EXPECTED_APOLLO_PEOPLE_PER_PAGE) {
    throw new Error(`Unexpected Apollo per_page: ${body.per_page}`);
  }
  if (headers.get("X-Api-Key") !== process.env.APOLLO_API_KEY) {
    throw new Error("Unexpected Apollo API key");
  }

  const resultOrgId = expectedOrgId ?? "org-1";

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
              id: resultOrgId,
              name: "Example Corp",
            },
          },
        ],
        total_entries: 2,
      };
    },
  };
};
