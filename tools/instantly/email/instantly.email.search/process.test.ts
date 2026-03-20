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
  "workflows/sales_prospect_research/tools/instantly.email.search/run",
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

test("email search executable returns the standard envelope", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, "--import", fetchMockPath, toolPath],
    {
      search: "welcome",
      limit: 1,
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      listId: "019c0e38-c5be-70d5-b730-fdd27bea4549",
      eaccount: ["sender@example.com", "sender2@example.com"],
    },
    {
      ...process.env,
      INSTANTLY_API_KEY: "test-key",
      EXPECTED_INSTANTLY_EMAIL_SEARCH: "welcome",
      EXPECTED_INSTANTLY_EMAIL_LIMIT: "1",
      EXPECTED_INSTANTLY_EMAIL_CAMPAIGN_ID: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      EXPECTED_INSTANTLY_EMAIL_LIST_ID: "019c0e38-c5be-70d5-b730-fdd27bea4549",
      EXPECTED_INSTANTLY_EMAIL_EACCOUNT: "sender@example.com,sender2@example.com",
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      emails: [{
        id: "email-1",
        subject: "Welcome",
        fromAddressEmail: "sender@example.com",
        leadEmail: "lead@example.com",
        eaccount: "sender@example.com",
        campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
        threadId: "thread-1",
        unread: true,
        timestampCreated: "2026-03-05T00:00:00.000Z",
      }],
      nextStartingAfter: "email-cursor-2",
    },
  });
});

test("email search workflow shim resolves to the same contract", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    shimPath,
    [],
    {
      search: "welcome",
      limit: 1,
      campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      listId: "019c0e38-c5be-70d5-b730-fdd27bea4549",
      eaccount: ["sender@example.com", "sender2@example.com"],
    },
    {
      ...process.env,
      INSTANTLY_API_KEY: "test-key",
      EXPECTED_INSTANTLY_EMAIL_SEARCH: "welcome",
      EXPECTED_INSTANTLY_EMAIL_LIMIT: "1",
      EXPECTED_INSTANTLY_EMAIL_CAMPAIGN_ID: "019c0e38-c5be-70d5-b730-fdd27bea4548",
      EXPECTED_INSTANTLY_EMAIL_LIST_ID: "019c0e38-c5be-70d5-b730-fdd27bea4549",
      EXPECTED_INSTANTLY_EMAIL_EACCOUNT: "sender@example.com,sender2@example.com",
      NODE_OPTIONS: `--import=${fetchMockPath}`,
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      emails: [{
        id: "email-1",
        subject: "Welcome",
        fromAddressEmail: "sender@example.com",
        leadEmail: "lead@example.com",
        eaccount: "sender@example.com",
        campaignId: "019c0e38-c5be-70d5-b730-fdd27bea4548",
        threadId: "thread-1",
        unread: true,
        timestampCreated: "2026-03-05T00:00:00.000Z",
      }],
      nextStartingAfter: "email-cursor-2",
    },
  });
});
