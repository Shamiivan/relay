import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/** The three lifecycle states a session can occupy. */
export type SessionStatus = "in_progress" | "paused" | "done";

/**
 * Metadata for a workflow session.
 * Status is derived from which subdir the session lives in — NOT stored in meta.
 */
export interface SessionMeta {
  id: string;
  displayName?: string;
  workflow: string;
  createdAt: string;
  updatedAt: string;
  forkedFrom: string | null;
  initialUserMessage?: string;
  /** Present when the session is paused or awaiting confirmation. */
  handoff?: {
    /** What the session is waiting for. */
    awaiting: string;
    /** Proposed final answer pending human confirmation (done_for_now flow). */
    proposed_final?: string;
    summary?: string;
    next_steps?: string[];
    artifacts?: Array<{ ref: string; description: string }>;
    last_action?: string;
  };
}

/** A session entry returned by listContexts. */
export interface SessionEntry {
  id: string;
  meta: SessionMeta;
  status: SessionStatus;
}

/** The subdirectory names that correspond to each status. */
const STATUS_DIRS: SessionStatus[] = ["in_progress", "paused", "done"];

function writeSessionHelperFiles(sessionDir: string, meta: SessionMeta): void {
  if (meta.initialUserMessage) {
    writeFileSync(join(sessionDir, "user_message.md"), `${meta.initialUserMessage.trim()}\n`, "utf8");
  }
  if (meta.displayName) {
    writeFileSync(join(sessionDir, "session_name.txt"), `${meta.displayName.trim()}\n`, "utf8");
  }
}

/**
 * Returns the path to a session dir given contextDir, status, and id.
 */
function sessionPath(contextDir: string, status: SessionStatus, id: string): string {
  return join(contextDir, status, id);
}

/**
 * Scan all three status subdirs to find the current status of a session.
 * Returns null if not found.
 */
function findSession(contextDir: string, id: string): SessionStatus | null {
  for (const status of STATUS_DIRS) {
    try {
      readdirSync(join(contextDir, status));
      // dir exists — check if the session subdir is present
      const entries = readdirSync(join(contextDir, status));
      if (entries.includes(id)) return status;
    } catch {
      // subdir doesn't exist yet — skip
    }
  }
  return null;
}

/**
 * Write (or overwrite) a session atomically into `.contexts/in_progress/{id}/`.
 * Uses write-tmp-then-rename for atomicity.
 *
 * Saves:
 * - meta.json
 * - thread-events.json
 *
 * Returns the session ID.
 */
export function checkpointContext(
  contextDir: string,
  meta: SessionMeta,
  eventsJson: string,
): string {
  const ts = meta.createdAt.replace(/:/g, "-");
  const sessionId = meta.id || `${meta.workflow}__${ts}`;

  const targetDir = join(contextDir, "in_progress");
  mkdirSync(targetDir, { recursive: true });

  const finalPath = join(targetDir, sessionId);
  const tmpPath = `${finalPath}.tmp-${process.pid}`;

  // Clean up any stale tmp from a previous crashed write
  rmSync(tmpPath, { recursive: true, force: true });

  mkdirSync(tmpPath, { recursive: true });
  writeFileSync(join(tmpPath, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  writeFileSync(join(tmpPath, "thread-events.json"), eventsJson, "utf8");
  writeSessionHelperFiles(tmpPath, meta);

  // If it already exists in in_progress, remove it first (overwrite on checkpoint)
  rmSync(finalPath, { recursive: true, force: true });
  renameSync(tmpPath, finalPath);

  return sessionId;
}

/**
 * Move a session from its current status subdir to a new one, and rewrite meta.json
 * with updated handoff / updatedAt fields.
 *
 * Scans all 3 subdirs to locate the session's current home.
 */
export function updateStatus(
  contextDir: string,
  id: string,
  newStatus: SessionStatus,
  handoff?: SessionMeta["handoff"],
): void {
  const currentStatus = findSession(contextDir, id);
  if (!currentStatus) {
    throw new Error(`Session not found: ${id}`);
  }

  const srcPath = sessionPath(contextDir, currentStatus, id);
  const dstDir = join(contextDir, newStatus);
  mkdirSync(dstDir, { recursive: true });
  const dstPath = join(dstDir, id);

  // Rewrite meta before moving
  const metaPath = join(srcPath, "meta.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as SessionMeta;
  meta.updatedAt = new Date().toISOString();
  if (handoff !== undefined) {
    meta.handoff = handoff;
  }
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
  writeSessionHelperFiles(srcPath, meta);

  if (currentStatus !== newStatus) {
    renameSync(srcPath, dstPath);
  }
}

/**
 * List sessions in a given status subdir.
 * No file opens needed for filtering — the subdir IS the filter.
 *
 * Returns entries sorted newest-first by createdAt.
 */
export function listContexts(contextDir: string, status: SessionStatus): SessionEntry[] {
  const dir = join(contextDir, status);
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const results: SessionEntry[] = [];
  for (const entry of entries) {
    if (entry.includes(".tmp-")) continue;
    try {
      const raw = readFileSync(join(dir, entry, "meta.json"), "utf8");
      const meta = JSON.parse(raw) as SessionMeta;
      results.push({ id: entry, meta, status });
    } catch {
      // Skip corrupt or unreadable sessions silently
    }
  }

  results.sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt));
  return results;
}

/**
 * Read the full session by scanning all status subdirs to find it.
 * Returns meta, eventsJson (raw JSON string), and the resolved status.
 */
export function readContext(
  contextDir: string,
  id: string,
): { meta: SessionMeta; eventsJson: string; status: SessionStatus } {
  const status = findSession(contextDir, id);
  if (!status) {
    throw new Error(`Session not found: ${id}`);
  }
  const dir = sessionPath(contextDir, status, id);
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as SessionMeta;
  const eventsJson = readFileSync(join(dir, "thread-events.json"), "utf8");
  return { meta, eventsJson, status };
}

/**
 * Scan `.contexts/in_progress/` and demote every session there to `paused`
 * with a recovery handoff message.
 *
 * Called at startup to clean up sessions that were interrupted mid-run.
 */
export function reconcileInProgress(contextDir: string): void {
  const dir = join(contextDir, "in_progress");
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return; // Nothing to reconcile
  }

  for (const entry of entries) {
    if (entry.includes(".tmp-")) continue;
    try {
      updateStatus(contextDir, entry, "paused", {
        awaiting: "recovery — previous run did not complete",
      });
    } catch {
      // Best-effort — skip any we can't move
    }
  }
}
