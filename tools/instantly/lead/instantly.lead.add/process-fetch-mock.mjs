globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);
  const body = JSON.parse(String(init?.body ?? "{}"));

  if (url.pathname !== "/api/v2/leads/add") {
    throw new Error(`Unexpected Instantly path: ${url.pathname}`);
  }
  if (headers.get("Authorization") !== `Bearer ${process.env.INSTANTLY_API_KEY}`) {
    throw new Error("Unexpected Instantly bearer token");
  }
  if (body.campaign_id !== process.env.EXPECTED_INSTANTLY_LEAD_CAMPAIGN_ID) {
    throw new Error(`Unexpected lead campaign: ${body.campaign_id}`);
  }
  if (!Array.isArray(body.leads) || body.leads[0]?.email !== process.env.EXPECTED_INSTANTLY_LEAD_EMAIL) {
    throw new Error("Unexpected leads payload");
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
        status: "success",
        leads_count: 1,
        invalid_emails_count: 0,
        duplicate_emails_count: 0,
        leads: [{
          id: "lead-1",
          email: process.env.EXPECTED_INSTANTLY_LEAD_EMAIL,
        }],
      };
    },
  };
};
