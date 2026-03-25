import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const toolPath = path.resolve(__dirname, "./tool.ts");
const fetchMockPath = path.resolve(__dirname, "./process-fetch-mock.mjs");
const tsxLoaderPath = path.join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs");

function canSpawnSubprocesses(): boolean {
  const probe = spawnSync(process.execPath, ["-e", ""], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (!probe.error) {
    return true;
  }
  return !("code" in probe.error && probe.error.code === "EPERM");
}

const subprocessExecutionAvailable = canSpawnSubprocesses();

/**
 * Runs a JSON stdio tool exactly the way Relay does at runtime.
 * This verifies the executable contract, not just the pure function helpers.
 */
async function runJsonTool(
  command: string,
  args: string[],
  input: unknown,
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    input: `${JSON.stringify(input)}\n`,
  });

  if (result.error) {
    throw result.error;
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status,
  };
}

test("tool executable returns the standard envelope over stdin/stdout", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, "--import", fetchMockPath, toolPath],
    { query: "B2B SaaS pain points", count: 1 },
      {
        ...process.env,
        BRAVE_API_KEY: "test-key",
        EXPECTED_BRAVE_QUERY: "B2B SaaS pain points",
        EXPECTED_BRAVE_COUNT: "1",
        EXPECTED_BRAVE_OFFSET: "0",
      },
    );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      results: [
        {
          title: "Pain Points",
          url: "https://example.com/pain-points",
          description: "Sales & Marketing pain-points for SaaS",
        },
      ],
      query: "B2B SaaS pain points",
      moreResultsAvailable: false,
    },
  });
});

test("live Brave smoke test parses the real API response shape", {
  skip: !(process.env.BRAVE_API_KEY && process.env.RUN_LIVE_BRAVE_TESTS === "1"),
}, async () => {
  const result = await runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    { query: "B2B SaaS pain points", count: 1 },
    process.env,
  );

  assert.equal(result.exitCode, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(Array.isArray(parsed.result.results), true);
  assert.equal(typeof parsed.result.query, "string");
  assert.equal(typeof parsed.result.moreResultsAvailable, "boolean");
});
