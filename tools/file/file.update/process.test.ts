import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { canSpawnSubprocesses, createTempWorkflowShim, runJsonTool } from "../../test-utils/process.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const toolPath = path.resolve(__dirname, "./tool.ts");
const tsxLoaderPath = path.join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs");
const subprocessExecutionAvailable = canSpawnSubprocesses(repoRoot);

test("file.update: executable returns the standard envelope", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-update-process-"));
  await mkdir(path.join(workspaceRoot, "artifacts"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "artifacts/offer.md"), "hello\nold\n");

  const result = runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    { path: "artifacts/offer.md", oldText: "old", newText: "new" },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.result.path, "artifacts/offer.md");
  assert.match(parsed.result.diff, /-old/);
  assert.match(parsed.result.diff, /\+new/);
});

test("file.update: temp workflow shim resolves to the same tool contract", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-update-shim-"));
  await mkdir(path.join(workspaceRoot, "artifacts"), { recursive: true });
  const { shimPath } = await createTempWorkflowShim({
    repoRoot,
    toolPath,
    toolName: "file.update",
  });
  const filePath = path.join(workspaceRoot, "artifacts/offer.md");
  await writeFile(filePath, "before\nold\nafter\n");

  const result = runJsonTool(
    shimPath,
    [],
    { path: "artifacts/offer.md", oldText: "old", newText: "new" },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(await readFile(filePath, "utf8"), "before\nnew\nafter\n");
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test("file.update: executable returns explicit error envelopes", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-update-process-"));
  await mkdir(path.join(workspaceRoot, "artifacts"), { recursive: true });
  const filePath = path.join(workspaceRoot, "artifacts/offer.md");
  await writeFile(filePath, "repeat\nrepeat\n");

  const ambiguousResult = runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    { path: "artifacts/offer.md", oldText: "repeat", newText: "new" },
    { cwd: workspaceRoot },
  );

  assert.equal(ambiguousResult.exitCode, 0);
  assert.deepEqual(JSON.parse(ambiguousResult.stdout), {
    ok: false,
    error: {
      type: "match_not_unique",
      message: "Found 2 occurrences in artifacts/offer.md; oldText must be unique",
      path: "artifacts/offer.md",
    },
  });

  const missingResult = runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    { path: "artifacts/missing.md", oldText: "a", newText: "b" },
    { cwd: workspaceRoot },
  );

  assert.equal(missingResult.exitCode, 0);
  assert.deepEqual(JSON.parse(missingResult.stdout), {
    ok: false,
    error: {
      type: "not_found",
      message: `Path not found while trying to read file: ${path.join(workspaceRoot, "artifacts/missing.md")}`,
      path: path.join(workspaceRoot, "artifacts/missing.md"),
    },
  });
});
