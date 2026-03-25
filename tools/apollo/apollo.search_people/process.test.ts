import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const toolPath = path.resolve(__dirname, "./tool.ts");
const shimPath = path.resolve(
  repoRoot,
  "workflows/sales_prospect_research/tools/apollo.search_people/run",
);
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
    { organizationIds: ["org-1"], perPage: 1 },
    {
      ...process.env,
      APOLLO_API_KEY: "test-key",
      EXPECTED_APOLLO_ORG_ID: "org-1",
      EXPECTED_APOLLO_PEOPLE_PER_PAGE: "1",
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      people: [
        {
          id: "person-1",
          firstName: "Taylor",
          lastName: "Smith",
          title: "VP Sales",
          organizationId: "org-1",
          organizationName: "Example Corp",
          hasEmail: true,
        },
      ],
      totalCount: 2,
      hasMore: true,
    },
  });
});

test("workflow shim resolves to the same tool contract the agent will call", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    shimPath,
    [],
    { organizationIds: ["org-1"], perPage: 1 },
    {
      ...process.env,
      APOLLO_API_KEY: "test-key",
      EXPECTED_APOLLO_ORG_ID: "org-1",
      EXPECTED_APOLLO_PEOPLE_PER_PAGE: "1",
      NODE_OPTIONS: `--import=${fetchMockPath}`,
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      people: [
        {
          id: "person-1",
          firstName: "Taylor",
          lastName: "Smith",
          title: "VP Sales",
          organizationId: "org-1",
          organizationName: "Example Corp",
          hasEmail: true,
        },
      ],
      totalCount: 2,
      hasMore: true,
    },
  });
});

test("tool works with general people filters without known organization IDs", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const result = await runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, "--import", fetchMockPath, toolPath],
    {
      keywords: "operations automation",
      titles: ["operations manager"],
      personLocations: ["Canada"],
      perPage: 2,
    },
    {
      ...process.env,
      APOLLO_API_KEY: "test-key",
      EXPECTED_APOLLO_PEOPLE_KEYWORDS: "operations automation",
      EXPECTED_APOLLO_PERSON_LOCATIONS: "Canada",
      EXPECTED_APOLLO_PERSON_TITLE: "operations manager",
      EXPECTED_APOLLO_PEOPLE_PER_PAGE: "2",
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      people: [
        {
          id: "person-1",
          firstName: "Taylor",
          lastName: "Smith",
          title: "VP Sales",
          organizationId: "org-1",
          organizationName: "Example Corp",
          hasEmail: true,
        },
      ],
      totalCount: 2,
      hasMore: false,
    },
  });
});
