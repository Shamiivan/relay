/**
 * Preloaded by the subprocess integration tests to replace the network boundary
 * with a deterministic fetch implementation. The mock validates the request
 * shape so the process tests still exercise URL construction and header setting.
 */
globalThis.fetch = async (input, _init) => {
  const url = new URL(String(input));

  if (url.protocol !== "https:") {
    throw new Error(`Expected https: scheme, got ${url.protocol}`);
  }
  if (String(input) !== process.env.EXPECTED_FETCH_URL) {
    throw new Error(`Unexpected fetch URL: ${String(input)}, expected ${process.env.EXPECTED_FETCH_URL}`);
  }

  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        if (name.toLowerCase() === "content-type") return "text/html; charset=utf-8";
        return null;
      },
    },
    async text() {
      return `<html><head><title>Test Page</title></head><body><p>Hello world from <strong>Relay</strong>.</p></body></html>`;
    },
  };
};
