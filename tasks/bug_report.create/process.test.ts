import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { canSpawnSubprocesses, runJsonTool } from "../../tools/test-utils/process.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const taskPath = path.resolve(__dirname, "./task.ts");
const runPath = path.resolve(__dirname, "./run");
const tsxLoaderPath = path.join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs");
const subprocessExecutionAvailable = canSpawnSubprocesses(repoRoot);

test("bug_report.create writes a normalized markdown file and returns the path plus terminal metadata", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-bug-report-task-"));
  await mkdir(path.join(workspaceRoot, "AGENTS", "bug_report"), { recursive: true });

  const result = runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, taskPath],
    {
      title: "Model reasoning tokens are not logged",
      description: "The logs never include model reasoning-token usage, even when the provider exposes it.",
      repro: "1. Run a model that reports reasoning-token usage.\n2. Inspect the generated logs.\n3. Observe that no reasoning-token field is present.",
      expected: "Logs should include reasoning-token usage when the provider returns it.",
      version: "0.49.0",
      date: "2026-03-29",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      path: "AGENTS/bug_report/2026-03-29-model-reasoning-tokens-are-not-logged.md",
      terminal: {
        status: "complete",
        instruction: "Call done_for_now next.",
      },
    },
  });

  const content = await readFile(
    path.join(workspaceRoot, "AGENTS", "bug_report", "2026-03-29-model-reasoning-tokens-are-not-logged.md"),
    "utf8",
  );
  assert.match(content, /^# Bug Report: Model reasoning tokens are not logged$/m);
  assert.match(content, /^## What happened\?$/m);
  assert.match(content, /^## Steps to reproduce$/m);
  assert.match(content, /^## Expected behavior$/m);
  assert.match(content, /^## Version$/m);
});

test("bug_report.create rejects invalid input and duplicate paths", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-bug-report-task-"));
  await mkdir(path.join(workspaceRoot, "AGENTS", "bug_report"), { recursive: true });

  const invalidResult = runJsonTool(
    runPath,
    [],
    {
      title: "",
      description: "Missing title should fail.",
      repro: "1. Try it.",
      expected: "",
      version: "",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(invalidResult.exitCode, 0);
  assert.equal(JSON.parse(invalidResult.stdout).ok, false);

  const firstCreate = runJsonTool(
    runPath,
    [],
    {
      title: "Duplicate bug",
      description: "Need duplicate-path behavior test.",
      repro: "1. Create once.\n2. Create again.",
      expected: "",
      version: "",
      date: "2026-03-29",
    },
    { cwd: workspaceRoot },
  );
  assert.equal(firstCreate.exitCode, 0);
  assert.equal(JSON.parse(firstCreate.stdout).ok, true);

  const duplicateCreate = runJsonTool(
    runPath,
    [],
    {
      title: "Duplicate bug",
      description: "Need duplicate-path behavior test.",
      repro: "1. Create once.\n2. Create again.",
      expected: "",
      version: "",
      date: "2026-03-29",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(duplicateCreate.exitCode, 0);
  assert.deepEqual(JSON.parse(duplicateCreate.stdout), {
    ok: false,
    error: {
      type: "already_exists",
      message: "File already exists: AGENTS/bug_report/2026-03-29-duplicate-bug.md",
    },
  });

  const emptyStdinResult = spawnSync(runPath, [], {
    cwd: workspaceRoot,
    env: process.env,
    encoding: "utf8",
    input: "",
  });

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
