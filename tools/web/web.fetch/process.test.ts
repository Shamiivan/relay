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

const TEST_URL = "https://example.com/test-page";

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
    { url: TEST_URL },
    {
      ...process.env,
      EXPECTED_FETCH_URL: TEST_URL,
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.result.url, TEST_URL);
  assert.equal(parsed.result.title, "Test Page");
  assert.ok(parsed.result.content.includes("Hello world from"));
  assert.ok(!parsed.result.content.includes("<strong>"), "HTML tags stripped");
  assert.equal(parsed.result.truncated, false);
});

test("live fetch smoke test returns non-empty content for a real URL", {
  skip: !(process.env.RUN_LIVE_FETCH_TESTS === "1"),
}, async () => {
  const result = await runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    { url: "https://example.com", maxChars: 5000 },
    process.env,
  );

  assert.equal(result.exitCode, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(typeof parsed.result.title, "string");
  assert.ok(parsed.result.content.length > 0);
  assert.equal(typeof parsed.result.truncated, "boolean");
});
