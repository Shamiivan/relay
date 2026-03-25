import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../../..");
const shimPath = path.resolve(__dirname, "./run");

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

function assertTimeEnvelope(stdout: string): void {
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.ok, true);
  assert.equal(typeof parsed.result.iso, "string");
  assert.equal(typeof parsed.result.local, "string");
  assert.equal(typeof parsed.result.timestamp, "number");
  assert.ok(Number.isFinite(parsed.result.timestamp));
  assert.ok(parsed.result.timestamp > 0);
  assert.ok(!Number.isNaN(Date.parse(parsed.result.iso)));
}

test("company workflow time.now shim returns the standard tool envelope", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const result = spawnSync(shimPath, [], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    input: "{}\n",
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assertTimeEnvelope(result.stdout);
});

test("company workflow time.now shim fails loudly on empty stdin", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const result = spawnSync(shimPath, [], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    input: "",
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: false,
    error: {
      type: "invalid_input",
      message: "Expected JSON on stdin. Provide '{}' for tools with no arguments.",
    },
  });
});

test("company workflow time.now shim fails loudly when launched with a TTY and no stdin payload", {
  skip: !subprocessExecutionAvailable || !process.stdin.isTTY,
}, () => {
  const result = spawnSync(shimPath, [], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: false,
    error: {
      type: "invalid_input",
      message: "Expected JSON on stdin. This tool does not accept interactive empty input. Pipe '{}' for tools with no arguments.",
    },
  });
});
