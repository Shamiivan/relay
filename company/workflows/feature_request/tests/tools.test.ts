import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { canSpawnSubprocesses, runJsonTool } from "../../../../tools/test-utils/process.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const createFeatureRequestRunPath = path.resolve(__dirname, "../tools/create_feature_request/run");
const cancelRunPath = path.resolve(__dirname, "../tools/cancel/run");
const subprocessExecutionAvailable = canSpawnSubprocesses(repoRoot);

test("feature_request create_feature_request wrapper returns the shared task contract", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-feature-request-workflow-"));
  await mkdir(path.join(workspaceRoot, "AGENTS", "feature_requests"), { recursive: true });

  const result = runJsonTool(
    createFeatureRequestRunPath,
    [],
    {
      title: "Workflow Wrapper",
      problem: "The workflow needs a discoverable executable tool surface.",
      context: "",
      proposed_change: "Expose the shared task through a workflow-local tool wrapper.",
      acceptance_criteria: ["The wrapper returns the created feature request path."],
      possible_tests: [],
      date: "2026-03-29",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      path: "AGENTS/feature_requests/2026-03-29-workflow-wrapper.md",
      terminal: {
        status: "complete",
        instruction: "Call done_for_now next.",
      },
    },
  });
});

test("feature_request cancel tool returns a proper cancellation envelope", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const result = runJsonTool(
    cancelRunPath,
    [],
    { reason: "User asked to drop the task." },
    { cwd: repoRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      reason: "User asked to drop the task.",
      terminal: {
        status: "complete",
        instruction: "Call done_for_now next.",
      },
    },
  });
});
