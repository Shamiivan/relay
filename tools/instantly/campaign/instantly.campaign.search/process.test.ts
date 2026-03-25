import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
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
 * Runs a JSON stdio tool exactly the way Relay calls it via workflow shims.
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
    { search: "Summer Sale Campaign", limit: 1, status: 1 },
    {
      ...process.env,
      INSTANTLY_API_KEY: "test-key",
      EXPECTED_INSTANTLY_SEARCH: "Summer Sale Campaign",
      EXPECTED_INSTANTLY_LIMIT: "1",
      EXPECTED_INSTANTLY_STATUS: "1",
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      campaigns: [
        {
          id: "campaign-1",
          name: "Summer Sale Campaign",
          status: 1,
          timestampCreated: "2026-01-30T09:25:22.952Z",
        },
      ],
      nextStartingAfter: "cursor-999",
    },
  });
});
