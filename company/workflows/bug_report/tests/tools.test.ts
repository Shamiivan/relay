import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { canSpawnSubprocesses, runJsonTool } from "../../../../tools/test-utils/process.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const createBugReportRunPath = path.resolve(__dirname, "../tools/create_bug_report/run");
const cancelRunPath = path.resolve(__dirname, "../tools/cancel/run");
const subprocessExecutionAvailable = canSpawnSubprocesses(repoRoot);

test("bug_report create_bug_report wrapper returns the shared task contract", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-bug-report-workflow-"));
  await mkdir(path.join(workspaceRoot, "AGENTS", "bug_report"), { recursive: true });

  const result = runJsonTool(
    createBugReportRunPath,
    [],
    {
      title: "Bug wrapper",
      description: "The workflow needs a discoverable executable tool surface for bugs.",
      repro: "1. Ask to file a bug.\n2. Let the workflow discover its tools.",
      expected: "The wrapper should create the bug report without extra path guesses.",
      version: "",
      date: "2026-03-29",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      path: "AGENTS/bug_report/2026-03-29-bug-wrapper.md",
      terminal: {
        status: "complete",
        instruction: "Call done_for_now next.",
      },
    },
  });
});

test("bug_report cancel tool returns a proper cancellation envelope", {
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
