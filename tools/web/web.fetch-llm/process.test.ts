import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { canSpawnSubprocesses, createTempWorkflowShim, runJsonTool } from "../../test-utils/process.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const toolPath = path.resolve(__dirname, "./tool.ts");
const fetchMockPath = path.resolve(__dirname, "./process-fetch-mock.mjs");
const tsxLoaderPath = path.join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs");
const subprocessExecutionAvailable = canSpawnSubprocesses(repoRoot);

test("web.fetch-llm: executable returns the standard envelope over stdin/stdout", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, "--import", fetchMockPath, toolPath],
    { query: "B2B SaaS pain points", count: 1 },
    { cwd: repoRoot, env: {
      ...process.env,
      BRAVE_API_KEY: "test-key",
      EXPECTED_BRAVE_QUERY: "B2B SaaS pain points",
      EXPECTED_BRAVE_COUNT: "1",
    } },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      query: "B2B SaaS pain points",
      results: [
        {
          url: "https://example.com/result",
          title: "Test Result",
          snippets: ["snippet text from the page"],
        },
      ],
    },
  });
});

test("web.fetch-llm: temp workflow shim resolves to the same tool contract", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const { shimPath, cwd } = await createTempWorkflowShim({
    repoRoot,
    toolPath,
    toolName: "web.fetch-llm",
  });
  const result = await runJsonTool(
    shimPath,
    [],
    { query: "B2B SaaS pain points", count: 1 },
    { cwd, env: {
      ...process.env,
      BRAVE_API_KEY: "test-key",
      EXPECTED_BRAVE_QUERY: "B2B SaaS pain points",
      EXPECTED_BRAVE_COUNT: "1",
      NODE_OPTIONS: `--import=${fetchMockPath}`,
    } },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.result.query, "B2B SaaS pain points");
  assert.equal(parsed.result.results.length, 1);
  assert.equal(parsed.result.results[0].url, "https://example.com/result");
});

test("web.fetch-llm: live Brave LLM context smoke test parses the real API response shape", {
  skip: !(process.env.BRAVE_API_KEY && process.env.RUN_LIVE_BRAVE_TESTS === "1"),
}, async () => {
  const result = await runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    { query: "B2B SaaS pain points", count: 1 },
    { cwd: repoRoot, env: process.env },
  );

  assert.equal(result.exitCode, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(Array.isArray(parsed.result.results), true);
  assert.equal(typeof parsed.result.query, "string");
});
