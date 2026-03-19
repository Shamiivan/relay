/**
 * Preloaded by the subprocess integration tests to replace the network boundary
 * with a deterministic fetch implementation. The mock validates the request
 * shape so the process tests still exercise URL construction and header setting.
 */
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);

  if (url.pathname !== "/res/v1/llm/context") {
    throw new Error(`Unexpected Brave path: ${url.pathname}`);
  }
  if (url.searchParams.get("q") !== process.env.EXPECTED_BRAVE_QUERY) {
    throw new Error(`Unexpected Brave query: ${url.searchParams.get("q")}`);
  }
  if (url.searchParams.get("count") !== process.env.EXPECTED_BRAVE_COUNT) {
    throw new Error(`Unexpected Brave count: ${url.searchParams.get("count")}`);
  }
  if (url.searchParams.get("maximum_number_of_urls") !== process.env.EXPECTED_BRAVE_COUNT) {
    throw new Error(
      `Unexpected maximum_number_of_urls: ${url.searchParams.get("maximum_number_of_urls")}`,
    );
  }
  if (headers.get("X-Subscription-Token") !== process.env.BRAVE_API_KEY) {
    throw new Error("Unexpected Brave subscription token");
  }

  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    async text() {
      return "";
    },
    async json() {
      return {
        grounding: {
          generic: [
            {
              url: "https://example.com/result",
              title: "Test Result",
              snippets: ["snippet text from the page"],
            },
          ],
        },
      };
    },
  };
};
