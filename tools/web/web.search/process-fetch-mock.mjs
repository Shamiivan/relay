/**
 * Preloaded by the subprocess integration tests to replace the network boundary
 * with a deterministic fetch implementation. The mock validates the request
 * shape so the process tests still exercise URL and header construction.
 */
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);

  if (url.pathname !== "/res/v1/web/search") {
    throw new Error(`Unexpected Brave path: ${url.pathname}`);
  }
  if (url.searchParams.get("q") !== process.env.EXPECTED_BRAVE_QUERY) {
    throw new Error(`Unexpected Brave query: ${url.searchParams.get("q")}`);
  }
  if (url.searchParams.get("count") !== process.env.EXPECTED_BRAVE_COUNT) {
    throw new Error(`Unexpected Brave count: ${url.searchParams.get("count")}`);
  }
  if (url.searchParams.get("offset") !== process.env.EXPECTED_BRAVE_OFFSET) {
    throw new Error(`Unexpected Brave offset: ${url.searchParams.get("offset")}`);
  }
  if (headers.get("X-Subscription-Token") !== process.env.BRAVE_API_KEY) {
    throw new Error("Unexpected Brave subscription token");
  }

  return {
    ok: true,
    status: 200,
    async text() {
      return "";
    },
    async json() {
      return {
        query: {
          original: process.env.EXPECTED_BRAVE_QUERY,
          more_results_available: false,
        },
        web: {
          results: [
            {
              title: "Pain Points",
              url: "https://example.com/pain-points",
              description: "Sales &amp; Marketing <strong>pain-points</strong> for SaaS",
            },
          ],
        },
      };
    },
  };
};
