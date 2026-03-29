import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { canSpawnSubprocesses, runJsonTool } from "../../../../tools/test-utils/process.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const listFeatureRequestsRunPath = path.resolve(__dirname, "../tools/list_feature_requests/run");
const subprocessExecutionAvailable = canSpawnSubprocesses(repoRoot);

test("feature_request list_feature_requests returns the current markdown feature requests", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-feature-request-list-"));
  const featureRequestDir = path.join(workspaceRoot, "AGENTS", "feature_requests");
  await mkdir(featureRequestDir, { recursive: true });
  await writeFile(path.join(featureRequestDir, "CONTRACT.md"), "# contract\n", "utf8");
  await writeFile(path.join(featureRequestDir, "a-first-request.md"), "# request 1\n", "utf8");
  await writeFile(path.join(featureRequestDir, "z-second-request.md"), "# request 2\n", "utf8");

  const result = runJsonTool(
    listFeatureRequestsRunPath,
    [],
    {},
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      count: 2,
      reports: [
        { name: "a-first-request.md", path: "AGENTS/feature_requests/a-first-request.md" },
        { name: "z-second-request.md", path: "AGENTS/feature_requests/z-second-request.md" },
      ],
    },
  });
});
