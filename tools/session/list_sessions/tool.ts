#!/usr/bin/env tsx
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function main(): void {
  const contextDir = join(process.cwd(), ".contexts");
  const pausedDir = join(contextDir, "paused");

  let entries: string[];
  try {
    entries = readdirSync(pausedDir).filter(e => !e.includes(".tmp-"));
  } catch {
    process.stdout.write("<sessions>\n</sessions>\n");
    return;
  }

  const sessions = entries
    .flatMap(entry => {
      try {
        const meta = JSON.parse(readFileSync(join(pausedDir, entry, "meta.json"), "utf8"));
        return [meta];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const lines: string[] = ["<sessions>"];
  for (const meta of sessions) {
    const h = meta.handoff ?? {};
    lines.push(`  <session id="${escapeXml(meta.id)}">`);
    if (meta.displayName) lines.push(`    <display_name>${escapeXml(meta.displayName)}</display_name>`);
    lines.push(`    <workflow>${escapeXml(meta.workflow)}</workflow>`);
    lines.push(`    <created_at>${escapeXml(meta.createdAt)}</created_at>`);
    if (h.awaiting) lines.push(`    <awaiting>${escapeXml(h.awaiting)}</awaiting>`);
    if (h.proposed_final) lines.push(`    <proposed_final>${escapeXml(h.proposed_final)}</proposed_final>`);
    if (h.summary) lines.push(`    <summary>${escapeXml(h.summary)}</summary>`);
    if (h.last_action) lines.push(`    <last_action>${escapeXml(h.last_action)}</last_action>`);
    lines.push(`  </session>`);
  }
  lines.push("</sessions>");

  process.stdout.write(lines.join("\n") + "\n");
}

main();
