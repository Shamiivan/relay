globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);

  if (!url.pathname.endsWith("/sending-status")) {
    throw new Error(`Unexpected Instantly path: ${url.pathname}`);
  }
  if (url.searchParams.get("with_ai_summary") !== process.env.EXPECTED_WITH_AI_SUMMARY) {
    throw new Error(`Unexpected with_ai_summary: ${url.searchParams.get("with_ai_summary")}`);
  }
  if (headers.get("Authorization") !== `Bearer ${process.env.INSTANTLY_API_KEY}`) {
    throw new Error("Unexpected Instantly bearer token");
  }

  return {
    ok: true,
    status: 200,
    headers: { get() { return null; } },
    async text() { return ""; },
    async json() {
      return {
        diagnostics: {
          campaign_id: process.env.EXPECTED_CAMPAIGN_ID,
          status: "ok",
        },
        summary: {
          title: "Healthy",
        },
      };
    },
  };
};
