import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { checkpointContext, type SessionMeta } from "../../src/context-store.ts";
import { deriveSessionName } from "../../src/session-naming.ts";

test("deriveSessionName drops greeting filler from the slug", () => {
  const result = deriveSessionName("hey there can we continue where we left off?");
  assert.equal(result.displayName, "continue where we left off");
  assert.equal(result.slug, "continue-left-off");
});

test("checkpointContext writes helper files for the user message and session name", () => {
  const root = mkdtempSync(path.join(tmpdir(), "relay-context-store-"));
  const contextDir = path.join(root, ".contexts");
  const meta: SessionMeta = {
    id: "continue-left-off__unknown__2026-03-29T00-00-00.000Z",
    displayName: "continue where we left off?",
    workflow: "unknown",
    createdAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
    forkedFrom: null,
    initialUserMessage: "hey there can we continue where we left off?",
  };

  try {
    checkpointContext(contextDir, meta, "[]");

    const sessionDir = path.join(contextDir, "in_progress", meta.id);
    assert.equal(
      readFileSync(path.join(sessionDir, "user_message.md"), "utf8"),
      "hey there can we continue where we left off?\n",
    );
    assert.equal(
      readFileSync(path.join(sessionDir, "session_name.txt"), "utf8"),
      "continue where we left off?\n",
    );
    assert.equal(existsSync(path.join(sessionDir, "thread-events.json")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
