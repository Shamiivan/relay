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

test("feature_request.create writes a normalized markdown file and returns only the path", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-feature-request-task-"));
  await mkdir(path.join(workspaceRoot, "AGENTS", "feature_requests"), { recursive: true });

  const result = runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, taskPath],
    {
      title: "Transport Layer Extraction",
      problem: "The runtime is coupled to CLI stdin and stdout.",
      context: "The same agent should be callable from Discord without forking the run loop.",
      proposed_change: "Extract a reusable transport boundary and move human interaction through it.",
      acceptance_criteria: [
        "CLI still works through the transport boundary.",
        "A second transport can drive the same runner.",
      ],
      possible_tests: [
        "CLI run still succeeds after the extraction.",
      ],
      date: "2026-03-29",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    result: {
      path: "AGENTS/feature_requests/2026-03-29-transport-layer-extraction.md",
      terminal: {
        status: "complete",
        instruction: "Call done_for_now next.",
      },
    },
  });

  const content = await readFile(
    path.join(workspaceRoot, "AGENTS", "feature_requests", "2026-03-29-transport-layer-extraction.md"),
    "utf8",
  );
  assert.match(content, /^# Feature Request: Transport Layer Extraction$/m);
  assert.match(content, /^## Problem$/m);
  assert.match(content, /^## Context$/m);
  assert.match(content, /^## Proposed Change$/m);
  assert.match(content, /^## Acceptance Criteria$/m);
  assert.match(content, /^## Possible Tests$/m);
});

test("feature_request.create returns explicit error envelopes for invalid input and duplicate paths", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-feature-request-task-"));
  await mkdir(path.join(workspaceRoot, "AGENTS", "feature_requests"), { recursive: true });

  const invalidResult = runJsonTool(
    process.execPath,
    ["--import", tsxLoaderPath, taskPath],
    {
      title: "",
      problem: "Missing title should fail.",
      proposed_change: "N/A",
      acceptance_criteria: ["N/A"],
    },
    { cwd: workspaceRoot },
  );

  assert.equal(invalidResult.exitCode, 0);
  assert.equal(JSON.parse(invalidResult.stdout).ok, false);

  const firstCreate = runJsonTool(
    runPath,
    [],
    {
      title: "Log model reasoning tokens",
      problem: "Reasoning token usage is not written to logs.",
      context: "",
      proposed_change: "Write reasoning token usage to run logs when providers expose it.",
      acceptance_criteria: ["Reasoning token usage is present in logs when available."],
      possible_tests: [],
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
      title: "Log model reasoning tokens",
      problem: "Reasoning token usage is not written to logs.",
      context: "",
      proposed_change: "Write reasoning token usage to run logs when providers expose it.",
      acceptance_criteria: ["Reasoning token usage is present in logs when available."],
      possible_tests: [],
      date: "2026-03-29",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(duplicateCreate.exitCode, 0);
  assert.deepEqual(JSON.parse(duplicateCreate.stdout), {
    ok: false,
    error: {
      type: "already_exists",
      message: "File already exists: AGENTS/feature_requests/2026-03-29-log-model-reasoning-tokens.md",
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

test("feature_request.create omits optional markdown sections when context and possible_tests are empty", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-feature-request-task-"));
  await mkdir(path.join(workspaceRoot, "AGENTS", "feature_requests"), { recursive: true });

  const result = runJsonTool(
    runPath,
    [],
    {
      title: "No Optional Sections",
      problem: "The rendered file should stay minimal.",
      context: "",
      proposed_change: "Skip empty optional sections in the markdown output.",
      acceptance_criteria: ["The file contains only the required sections."],
      possible_tests: [],
      date: "2026-03-29",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(JSON.parse(result.stdout).ok, true);

  const content = await readFile(
    path.join(workspaceRoot, "AGENTS", "feature_requests", "2026-03-29-no-optional-sections.md"),
    "utf8",
  );
  assert.doesNotMatch(content, /^## Context$/m);
  assert.doesNotMatch(content, /^## Possible Tests$/m);
  assert.match(content, /^## Problem$/m);
  assert.match(content, /^## Proposed Change$/m);
  assert.match(content, /^## Acceptance Criteria$/m);
});

test("feature_request.create rejects invalid date overrides", {
  skip: !subprocessExecutionAvailable,
}, async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "relay-feature-request-task-"));
  await mkdir(path.join(workspaceRoot, "AGENTS", "feature_requests"), { recursive: true });

  const result = runJsonTool(
    runPath,
    [],
    {
      title: "Bad Date",
      problem: "The filename date prefix should be normalized.",
      context: "",
      proposed_change: "Reject dates that are not YYYY-MM-DD.",
      acceptance_criteria: ["Invalid dates return a validation error."],
      possible_tests: [],
      date: "20260329",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: false,
    error: {
      type: "validation",
      message: "Invalid string: must match pattern /^\\d{4}-\\d{2}-\\d{2}$/",
    },
  });
});
