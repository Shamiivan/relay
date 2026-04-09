import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
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

test("file.write: executable returns the standard envelope", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-process-"));
  const result = runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    { path: "artifacts/offer.md", content: "hello\n", mode: "create" },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      path: "artifacts/offer.md",
      resolvedPath: path.join(workspaceRoot, "artifacts/offer.md"),
      mode: "create",
      created: true,
      bytesWritten: Buffer.byteLength("hello\n"),
    },
  });
});

test("file.write: temp workflow shim resolves to the same tool contract", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-shim-"));
  await mkdir(path.join(workspaceRoot, "artifacts"), { recursive: true });
  const { shimPath } = await createTempWorkflowShim({
    repoRoot,
    toolPath,
    toolName: "file.write",
  });
  const result = runJsonTool(
    shimPath,
    [],
    { path: "artifacts/offer.md", content: "shim\n", mode: "upsert" },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.equal(await readFile(path.join(workspaceRoot, "artifacts/offer.md"), "utf8"), "shim\n");
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test("file.write: executable returns explicit error envelopes", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-process-"));
  const existingPath = path.join(workspaceRoot, "artifacts", "offer.md");
  await mkdir(path.dirname(existingPath), { recursive: true });
  await import("node:fs/promises").then(({ writeFile }) => writeFile(existingPath, "existing\n"));

  const existingResult = runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    { path: "artifacts/offer.md", content: "new\n", mode: "create" },
    { cwd: workspaceRoot },
  );

  assert.equal(existingResult.exitCode, 0);
  assert.deepEqual(JSON.parse(existingResult.stdout), {
    ok: false,
    error: {
      type: "already_exists",
      message: "File already exists: artifacts/offer.md",
      path: "artifacts/offer.md",
    },
  });

  const pathResult = runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    { path: "../outside.md", content: "x", mode: "upsert" },
    { cwd: workspaceRoot },
  );

  assert.equal(pathResult.exitCode, 0);
  assert.deepEqual(JSON.parse(pathResult.stdout), {
    ok: false,
    error: {
      type: "path_not_allowed",
      message: `Path must stay inside the workspace root: ${workspaceRoot}`,
      path: "../outside.md",
    },
  });

  const emptyStdinResult = spawnSync(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    {
      cwd: workspaceRoot,
      env: process.env,
      encoding: "utf8",
      input: "",
    },
  );

  if (emptyStdinResult.error) {
    throw emptyStdinResult.error;
  }

  assert.equal(emptyStdinResult.status, 0);
  assert.deepEqual(JSON.parse(emptyStdinResult.stdout), {
    ok: false,
    error: {
      type: "invalid_input",
      message: "Expected JSON on stdin. Provide '{}' for tools with no arguments.",
    },
  });
});

test("file.write: executable accepts piped JSON with literal newlines inside string values", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-file-write-raw-json-"));
  const rawInput = '{ "path": "artifacts/offer.md", "content": "hello\nworld\n", "mode": "create" }\n';

  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoaderPath, toolPath],
    {
      cwd: workspaceRoot,
      env: process.env,
      encoding: "utf8",
      input: rawInput,
    },
  );

  if (result.error) {
    throw result.error;
  }

  assert.equal(result.status, 0);
  assert.equal(await readFile(path.join(workspaceRoot, "artifacts/offer.md"), "utf8"), "hello\nworld\n");
  assert.equal(JSON.parse(result.stdout).ok, true);
});
