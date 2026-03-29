#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonInput } from "../../lib/json-stdio.ts";
import { Thread } from "../../../runtime/src/thread.ts";
import type { ThreadEvent } from "../../../runtime/src/thread.ts";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const STATUS_DIRS = ["paused", "in_progress", "done"] as const;

async function main(): Promise<void> {
  let input: { id: string };
  try {
    input = (await readJsonInput()) as { id: string };
  } catch (e) {
    process.stderr.write(`Error reading input: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }

  if (!input.id) {
    process.stderr.write("Error: id is required. Use list_sessions to discover session ids.\n");
    process.exit(1);
  }

  const contextDir = join(process.cwd(), ".contexts");
  let meta: Record<string, unknown> | null = null;
  let sessionDir = "";

  for (const status of STATUS_DIRS) {
    try {
      const p = join(contextDir, status, input.id, "meta.json");
      meta = JSON.parse(readFileSync(p, "utf8"));
      sessionDir = join(contextDir, status, input.id);
      break;
    } catch {
      // not in this subdir
    }
  }

  if (!meta) {
    process.stderr.write(`Error: session not found: ${input.id}\n`);
    process.exit(1);
  }

  const h = (meta.handoff ?? {}) as Record<string, unknown>;

  // Build thread XML from events
  let threadXml = "";
  try {
    const eventsRaw = readFileSync(join(sessionDir, "thread-events.json"), "utf8");
    const events = JSON.parse(eventsRaw) as ThreadEvent[];
    const thread = new Thread({ state: null, events });
    threadXml = thread.serializeForLLM();
  } catch {
    // no events yet
  }

  const lines: string[] = [`<session id="${escapeXml(String(meta.id))}">`];
  if (meta.displayName) lines.push(`  <display_name>${escapeXml(String(meta.displayName))}</display_name>`);
  lines.push(`  <workflow>${escapeXml(String(meta.workflow))}</workflow>`);
  lines.push(`  <created_at>${escapeXml(String(meta.createdAt))}</created_at>`);
  if (h.awaiting) lines.push(`  <awaiting>${escapeXml(String(h.awaiting))}</awaiting>`);
  if (h.proposed_final) lines.push(`  <proposed_final>${escapeXml(String(h.proposed_final))}</proposed_final>`);
  if (h.summary) lines.push(`  <summary>${escapeXml(String(h.summary))}</summary>`);
  if (h.last_action) lines.push(`  <last_action>${escapeXml(String(h.last_action))}</last_action>`);
  if (threadXml) {
    lines.push(`  <thread>`);
    lines.push(threadXml);
    lines.push(`  </thread>`);
  }
  lines.push(`</session>`);

  process.stdout.write(lines.join("\n") + "\n");
}

void main();
