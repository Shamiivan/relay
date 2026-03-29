import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { canSpawnSubprocesses, runJsonTool } from "../../../../tools/test-utils/process.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const listBugReportsRunPath = path.resolve(__dirname, "../tools/list_bug_reports/run");
const subprocessExecutionAvailable = canSpawnSubprocesses(repoRoot);

test("bug_report list_bug_reports returns the current markdown bug reports", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-bug-report-list-"));
  const bugDir = path.join(workspaceRoot, "AGENTS", "bug_report");
  await mkdir(bugDir, { recursive: true });
  await writeFile(path.join(bugDir, "CONTRACT.md"), "# contract\n", "utf8");
  await writeFile(path.join(bugDir, "a-first-bug.md"), "# bug 1\n", "utf8");
  await writeFile(path.join(bugDir, "z-second-bug.md"), "# bug 2\n", "utf8");

  const result = runJsonTool(
    listBugReportsRunPath,
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
        { name: "a-first-bug.md", path: "AGENTS/bug_report/a-first-bug.md" },
        { name: "z-second-bug.md", path: "AGENTS/bug_report/z-second-bug.md" },
      ],
    },
  });
});
