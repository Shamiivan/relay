import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const toolPath = path.resolve(__dirname, "./tool.ts");
const shimPath = path.resolve(
  repoRoot,
  "workflows/sales_prospect_research/tools/instantly.account.search/run",
);
const fetchMockPath = path.resolve(__dirname, "./process-fetch-mock.mjs");
const tsxLoaderPath = path.join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs");

function canSpawnSubprocesses(): boolean {
  const probe = spawnSync(process.execPath, ["-e", ""], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return !probe.error || !("code" in probe.error && probe.error.code === "EPERM");
}

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
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

const subprocessExecutionAvailable = canSpawnSubprocesses();

test("account search executable returns the standard envelope", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, "--import", fetchMockPath, toolPath],
    { search: "sender@example.com", limit: 1, providerCode: 2, tagIds: ["tag-1", "tag-2"] },
    {
      ...process.env,
      INSTANTLY_API_KEY: "test-key",
      EXPECTED_INSTANTLY_ACCOUNT_SEARCH: "sender@example.com",
      EXPECTED_INSTANTLY_ACCOUNT_LIMIT: "1",
      EXPECTED_INSTANTLY_ACCOUNT_PROVIDER_CODE: "2",
      EXPECTED_INSTANTLY_ACCOUNT_TAG_IDS: "tag-1,tag-2",
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      accounts: [{
        email: "sender@example.com",
        status: 1,
        providerCode: 2,
        warmupStatus: 3,
        timestampCreated: "2026-03-01T00:00:00.000Z",
      }],
      nextStartingAfter: "account-cursor-2",
    },
  });
});

test("account search workflow shim resolves to the same contract", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    shimPath,
    [],
    { search: "sender@example.com", limit: 1, providerCode: 2, tagIds: ["tag-1", "tag-2"] },
    {
      ...process.env,
      INSTANTLY_API_KEY: "test-key",
      EXPECTED_INSTANTLY_ACCOUNT_SEARCH: "sender@example.com",
      EXPECTED_INSTANTLY_ACCOUNT_LIMIT: "1",
      EXPECTED_INSTANTLY_ACCOUNT_PROVIDER_CODE: "2",
      EXPECTED_INSTANTLY_ACCOUNT_TAG_IDS: "tag-1,tag-2",
      NODE_OPTIONS: `--import=${fetchMockPath}`,
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      accounts: [{
        email: "sender@example.com",
        status: 1,
        providerCode: 2,
        warmupStatus: 3,
        timestampCreated: "2026-03-01T00:00:00.000Z",
      }],
      nextStartingAfter: "account-cursor-2",
    },
  });
});
