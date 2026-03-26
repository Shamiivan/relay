import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Metadata for a workflow session.
 * Status lives here only — never encoded in the directory name.
 */
export interface SessionMeta {
  workflow: string;
  scope: string;
  status: "paused" | "done";
  phase: string;
  /** The question or action the session is waiting on. */
  pending: string;
  approved: string[];
  rejected: string[];
  createdAt: string;
  /** Set when this session was copied from another via `relay fork`. */
  forkedFrom: string | null;
}

/** A session entry returned by listContexts. */
export interface SessionEntry {
  /** Directory basename, e.g. email_campaign__2026-03-26T09-00-00Z */
  id: string;
  meta: SessionMeta;
}

/**
 * Write a new session atomically.
 * Writes into a .tmp-<pid> directory, then renames to the final name.
 * Safe to call concurrently from multiple processes on the same machine.
 *
 * Saves two files:
 * - thread-events.json: structured event array for rehydration on resume
 * - thread.txt: human-readable serialized thread for debugging
 *
 * Returns the session ID (directory basename).
 */
export function checkpointContext(
  contextDir: string,
  meta: SessionMeta,
  eventsJson: string,
  threadContent: string,
): string {
  mkdirSync(contextDir, { recursive: true });

  const ts = meta.createdAt.replace(/:/g, "-");
  const sessionId = `${meta.workflow}__${ts}`;
  const finalPath = join(contextDir, sessionId);
  const tmpPath = `${finalPath}.tmp-${process.pid}`;

  // Clean up any stale tmp from a previous crashed write
  rmSync(tmpPath, { recursive: true, force: true });

  mkdirSync(tmpPath, { recursive: true });
  writeFileSync(join(tmpPath, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  writeFileSync(join(tmpPath, "thread-events.json"), eventsJson, "utf8");
  writeFileSync(join(tmpPath, "thread.txt"), threadContent, "utf8");

  renameSync(tmpPath, finalPath);

  return sessionId;
}

/**
 * List sessions, optionally filtered by status.
 * Reads only meta.json — never thread.txt — for speed.
 */
export function listContexts(
  contextDir: string,
  filter?: { status?: "paused" | "done" },
): SessionEntry[] {
  let entries: string[];
  try {
    entries = readdirSync(contextDir);
  } catch {
    return [];
  }

  const results: SessionEntry[] = [];
  for (const entry of entries) {
    if (entry.includes(".tmp-")) continue;
    try {
      const raw = readFileSync(join(contextDir, entry, "meta.json"), "utf8");
      const meta = JSON.parse(raw) as SessionMeta;
      if (filter?.status && meta.status !== filter.status) continue;
      results.push({ id: entry, meta });
    } catch {
      // Skip corrupt or unreadable sessions silently
    }
  }

  // Newest first
  results.sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt));
  return results;
}

/**
 * Update a session's status by rewriting meta.json.
 * No directory rename — the ID is immutable.
 */
export function updateStatus(
  contextDir: string,
  sessionId: string,
  newStatus: "done",
): void {
  const metaPath = join(contextDir, sessionId, "meta.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as SessionMeta;
  meta.status = newStatus;
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
}

/**
 * Read the full session — metadata, structured events, and debug text.
 * `eventsJson` is a raw JSON string of ThreadEvent[] — callers parse it.
 */
export function readContext(
  contextDir: string,
  sessionId: string,
): { meta: SessionMeta; eventsJson: string; threadContent: string } {
  const dir = join(contextDir, sessionId);
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as SessionMeta;
  const eventsJson = readFileSync(join(dir, "thread-events.json"), "utf8");
  const threadContent = readFileSync(join(dir, "thread.txt"), "utf8");
  return { meta, eventsJson, threadContent };
}
