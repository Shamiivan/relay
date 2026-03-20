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
  "workflows/sales_prospect_research/tools/instantly.lead.add/run",
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

test("lead add executable returns the standard envelope", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, "--import", fetchMockPath, toolPath],
    {
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      leads: [{ email: "ada@example.com" }],
    },
    {
      ...process.env,
      INSTANTLY_API_KEY: "test-key",
      EXPECTED_INSTANTLY_LEAD_CAMPAIGN_ID: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      EXPECTED_INSTANTLY_LEAD_EMAIL: "ada@example.com",
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      status: "success",
      leadsCount: 1,
      invalidEmailsCount: 0,
      duplicateEmailsCount: 0,
      leads: [{
        id: "lead-1",
        email: "ada@example.com",
      }],
    },
  });
});

test("lead add workflow shim resolves to the same contract", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    shimPath,
    [],
    {
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      leads: [{ email: "ada@example.com" }],
    },
    {
      ...process.env,
      INSTANTLY_API_KEY: "test-key",
      EXPECTED_INSTANTLY_LEAD_CAMPAIGN_ID: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      EXPECTED_INSTANTLY_LEAD_EMAIL: "ada@example.com",
      NODE_OPTIONS: `--import=${fetchMockPath}`,
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      status: "success",
      leadsCount: 1,
      invalidEmailsCount: 0,
      duplicateEmailsCount: 0,
      leads: [{
        id: "lead-1",
        email: "ada@example.com",
      }],
    },
  });
});
