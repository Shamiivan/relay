import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const listShim = path.resolve(__dirname, "../tools/list_sessions/run");
const resumeShim = path.resolve(__dirname, "../tools/resume_session/run");

function canSpawnSubprocesses(): boolean {
  const probe = spawnSync(process.execPath, ["-e", ""], { cwd: repoRoot, encoding: "utf8" });
  return !probe.error || !("code" in probe.error && probe.error.code === "EPERM");
}

const subprocessExecutionAvailable = canSpawnSubprocesses();

function makeFixtureDir(sessions: Array<{
  id: string;
  displayName?: string;
  workflow: string;
  createdAt: string;
  handoff?: Record<string, unknown>;
  events?: unknown[];
}>): string {
  const tmp = mkdtempSync(path.join(tmpdir(), "relay-session-test-"));
  for (const s of sessions) {
    const dir = path.join(tmp, ".contexts", "paused", s.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "meta.json"), JSON.stringify({
      id: s.id,
      displayName: s.displayName,
      workflow: s.workflow,
      createdAt: s.createdAt,
      updatedAt: s.createdAt,
      forkedFrom: null,
      handoff: s.handoff,
    }), "utf8");
    if (s.events) {
      writeFileSync(path.join(dir, "thread-events.json"), JSON.stringify(s.events), "utf8");
    }
  }
  return tmp;
}

function run(shim: string, input: string, cwd: string) {
  return spawnSync(shim, [], { cwd, encoding: "utf8", input });
}

test("list_sessions returns <sessions/> when nothing is paused", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "relay-session-test-empty-"));
  try {
    const result = run(listShim, "{}", tmp);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /<sessions>/);
    assert.match(result.stdout, /<\/sessions>/);
    assert.doesNotMatch(result.stdout, /<session /);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("list_sessions shows id, workflow, awaiting for each paused session", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const tmp = makeFixtureDir([{
    id: "test-session__email_campaign__2026-01-01T00-00-00.000Z",
    displayName: "target market follow-up",
    workflow: "email_campaign",
    createdAt: "2026-01-01T00:00:00.000Z",
    handoff: { awaiting: "What is the target market?" },
  }]);
  try {
    const result = run(listShim, "{}", tmp);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /id="test-session__email_campaign__2026-01-01T00-00-00\.000Z"/);
    assert.match(result.stdout, /<display_name>target market follow-up<\/display_name>/);
    assert.match(result.stdout, /<workflow>email_campaign<\/workflow>/);
    assert.match(result.stdout, /<awaiting>What is the target market\?<\/awaiting>/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("list_sessions shows proposed_final when present", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const tmp = makeFixtureDir([{
    id: "done-session__unknown__2026-01-02T00-00-00.000Z",
    workflow: "unknown",
    createdAt: "2026-01-02T00:00:00.000Z",
    handoff: { awaiting: "completion_confirmation", proposed_final: "The number is 1969." },
  }]);
  try {
    const result = run(listShim, "{}", tmp);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /<proposed_final>The number is 1969\.<\/proposed_final>/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("list_sessions sorts newest session first", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const tmp = makeFixtureDir([
    { id: "old__wf__2026-01-01T00-00-00.000Z", workflow: "wf", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "new__wf__2026-01-03T00-00-00.000Z", workflow: "wf", createdAt: "2026-01-03T00:00:00.000Z" },
  ]);
  try {
    const result = run(listShim, "{}", tmp);
    assert.equal(result.status, 0, result.stderr);
    const newIdx = result.stdout.indexOf("new__wf");
    const oldIdx = result.stdout.indexOf("old__wf");
    assert.ok(newIdx < oldIdx, "newest session should appear first");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resume_session exits non-zero when id is missing", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "relay-session-test-"));
  try {
    const result = run(resumeShim, "{}", tmp);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /id is required/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resume_session exits non-zero for unknown id", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "relay-session-test-"));
  try {
    const result = run(resumeShim, JSON.stringify({ id: "no-such-session" }), tmp);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /session not found/i);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resume_session returns <session> with metadata", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const id = "my-session__email_campaign__2026-01-01T00-00-00.000Z";
  const tmp = makeFixtureDir([{
    id,
    displayName: "target market follow-up",
    workflow: "email_campaign",
    createdAt: "2026-01-01T00:00:00.000Z",
    handoff: { awaiting: "What is the target market?", proposed_final: "B2B SaaS companies." },
  }]);
  try {
    const result = run(resumeShim, JSON.stringify({ id }), tmp);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`<session id="${id}">`));
    assert.match(result.stdout, /<display_name>target market follow-up<\/display_name>/);
    assert.match(result.stdout, /<workflow>email_campaign<\/workflow>/);
    assert.match(result.stdout, /<awaiting>What is the target market\?<\/awaiting>/);
    assert.match(result.stdout, /<proposed_final>B2B SaaS companies\.<\/proposed_final>/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resume_session includes <thread> block when thread-events.json exists", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const id = "threaded__wf__2026-01-01T00-00-00.000Z";
  const tmp = makeFixtureDir([{
    id,
    workflow: "wf",
    createdAt: "2026-01-01T00:00:00.000Z",
    handoff: { awaiting: "confirm?" },
    events: [
      { type: "user_message", data: "remember the number 42" },
      { type: "system_note", data: "I will remember 42." },
    ],
  }]);
  try {
    const result = run(resumeShim, JSON.stringify({ id }), tmp);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /<thread>/);
    assert.match(result.stdout, /remember the number 42/);
    assert.match(result.stdout, /I will remember 42\./);
    assert.match(result.stdout, /<\/thread>/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resume_session finds sessions in in_progress and done subdirs too", {
  skip: !subprocessExecutionAvailable,
}, () => {
  const id = "in-prog__wf__2026-01-01T00-00-00.000Z";
  const tmp = mkdtempSync(path.join(tmpdir(), "relay-session-test-"));
  const dir = path.join(tmp, ".contexts", "in_progress", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "meta.json"), JSON.stringify({
    id,
    workflow: "wf",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    forkedFrom: null,
  }), "utf8");
  try {
    const result = run(resumeShim, JSON.stringify({ id }), tmp);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`<session id="${id}">`));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
