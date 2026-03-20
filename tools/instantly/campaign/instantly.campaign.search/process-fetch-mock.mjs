/**
 * Preloaded by subprocess integration tests to validate the request boundary
 * without touching the real Instantly API.
 */
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);

  if (url.pathname !== "/api/v2/campaigns") {
    throw new Error(`Unexpected Instantly path: ${url.pathname}`);
  }
  if (url.searchParams.get("search") !== process.env.EXPECTED_INSTANTLY_SEARCH) {
    throw new Error(`Unexpected Instantly search: ${url.searchParams.get("search")}`);
  }
  if (url.searchParams.get("limit") !== process.env.EXPECTED_INSTANTLY_LIMIT) {
    throw new Error(`Unexpected Instantly limit: ${url.searchParams.get("limit")}`);
  }
  if (url.searchParams.get("status") !== process.env.EXPECTED_INSTANTLY_STATUS) {
    throw new Error(`Unexpected Instantly status: ${url.searchParams.get("status")}`);
  }
  if (headers.get("Authorization") !== `Bearer ${process.env.INSTANTLY_API_KEY}`) {
    throw new Error("Unexpected Instantly bearer token");
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
        items: [
          {
            id: "campaign-1",
            name: process.env.EXPECTED_INSTANTLY_SEARCH,
            status: Number(process.env.EXPECTED_INSTANTLY_STATUS),
            timestamp_created: "2026-01-30T09:25:22.952Z",
          },
        ],
        next_starting_after: "cursor-999",
      };
    },
  };
};
