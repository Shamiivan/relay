globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);

  if (url.pathname !== "/api/v2/emails") {
    throw new Error(`Unexpected Instantly path: ${url.pathname}`);
  }
  if (url.searchParams.get("search") !== process.env.EXPECTED_INSTANTLY_EMAIL_SEARCH) {
    throw new Error(`Unexpected email search: ${url.searchParams.get("search")}`);
  }
  if (url.searchParams.get("limit") !== process.env.EXPECTED_INSTANTLY_EMAIL_LIMIT) {
    throw new Error(`Unexpected email limit: ${url.searchParams.get("limit")}`);
  }
  if (url.searchParams.get("list_id") !== process.env.EXPECTED_INSTANTLY_EMAIL_LIST_ID) {
    throw new Error(`Unexpected email list id: ${url.searchParams.get("list_id")}`);
  }
  if (url.searchParams.get("eaccount") !== process.env.EXPECTED_INSTANTLY_EMAIL_EACCOUNT) {
    throw new Error(`Unexpected eaccount filter: ${url.searchParams.get("eaccount")}`);
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
          id: "email-1",
          subject: "Welcome",
          from_address_email: "sender@example.com",
          lead: "lead@example.com",
          eaccount: "sender@example.com",
          campaign_id: process.env.EXPECTED_INSTANTLY_EMAIL_CAMPAIGN_ID,
          thread_id: "thread-1",
          is_unread: 1,
          timestamp_created: "2026-03-05T00:00:00.000Z",
        }],
        next_starting_after: "email-cursor-2",
      };
    },
  };
};
