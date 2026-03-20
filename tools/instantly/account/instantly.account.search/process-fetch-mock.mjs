globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);

  if (url.pathname !== "/api/v2/accounts") {
    throw new Error(`Unexpected Instantly path: ${url.pathname}`);
  }
  if (url.searchParams.get("search") !== process.env.EXPECTED_INSTANTLY_ACCOUNT_SEARCH) {
    throw new Error(`Unexpected account search: ${url.searchParams.get("search")}`);
  }
  if (url.searchParams.get("limit") !== process.env.EXPECTED_INSTANTLY_ACCOUNT_LIMIT) {
    throw new Error(`Unexpected account limit: ${url.searchParams.get("limit")}`);
  }
  if (url.searchParams.get("provider_code") !== process.env.EXPECTED_INSTANTLY_ACCOUNT_PROVIDER_CODE) {
    throw new Error(`Unexpected account provider code: ${url.searchParams.get("provider_code")}`);
  }
  if (url.searchParams.get("tag_ids") !== process.env.EXPECTED_INSTANTLY_ACCOUNT_TAG_IDS) {
    throw new Error(`Unexpected account tag ids: ${url.searchParams.get("tag_ids")}`);
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
        items: [{
          email: process.env.EXPECTED_INSTANTLY_ACCOUNT_SEARCH,
          status: 1,
          provider_code: 2,
          warmup_status: 3,
          timestamp_created: "2026-03-01T00:00:00.000Z",
        }],
        next_starting_after: "account-cursor-2",
      };
    },
  };
};
