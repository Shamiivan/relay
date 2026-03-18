import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { ContextSection } from "../context/sections.ts";
import { ClarificationRequest, DoneForNow, type IntentDeclaration } from "../step/contract.ts";

// Frontmatter format (inside ---):
//   intent: find_reference_doc
//   description: Prepare a Drive search plan
//   fields:
//     userRequest: "string: The user request to interpret"
//     maxResults: "number: Max files to return"

type Frontmatter = {
  intent?: string;
  description?: string;
  fields?: Record<string, { type: "string" | "number" | "boolean"; description?: string }>;
};

function parseFrontmatter(content: string): { meta: Frontmatter; body: string } {
  if (!content.startsWith("---\n")) return { meta: {}, body: content };
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return { meta: {}, body: content };

  const yamlBlock = content.slice(4, end);
  const body = content.slice(end + 5).trim();
  const meta: Frontmatter = {};
  let inFields = false;

  for (const line of yamlBlock.split("\n")) {
    if (line === "fields:") {
      inFields = true;
      meta.fields = {};
      continue;
    }
    if (inFields) {
      if (line.startsWith("  ")) {
        // "  fieldName: type: description" or "  fieldName: \"type: description\""
        const stripped = line.slice(2).replace(/^"|"$/g, "");
        const colonIdx = stripped.indexOf(":");
        if (colonIdx === -1) continue;
        const fieldName = stripped.slice(0, colonIdx).trim();
        const rest = stripped.slice(colonIdx + 1).trim().replace(/^"|"$/g, "");
        const typeColonIdx = rest.indexOf(":");
        const type = (typeColonIdx === -1 ? rest : rest.slice(0, typeColonIdx)).trim() as
          | "string"
          | "number"
          | "boolean";
        const description =
          typeColonIdx === -1 ? undefined : rest.slice(typeColonIdx + 1).trim() || undefined;
        meta.fields![fieldName] = { type, description };
        continue;
      }
      inFields = false;
    }
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim().replace(/^"|"$/g, "");
    if (key === "intent") meta.intent = value;
    else if (key === "description") meta.description = value;
  }

  return { meta, body };
}

function readReadme(dir: string): { meta: Frontmatter; body: string } | null {
  const p = path.join(dir, "README.md");
  if (!existsSync(p)) return null;
  return parseFrontmatter(readFileSync(p, "utf8"));
}

function firstLine(text: string): string {
  return text.split("\n").find((l) => l.trim())?.trim() ?? "";
}

function listSubdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export type ExecutableManifest = {
  kind: "task" | "tool";
  intent: IntentDeclaration;
  dir: string;
};

export type WorkflowManifest = {
  dir: string;
  name: string;
  intent: IntentDeclaration;
  terminalIntents: readonly IntentDeclaration[];
  contract: readonly IntentDeclaration[];
  sections: ContextSection[];
  executables: ReadonlyMap<string, ExecutableManifest>;
};

function buildIntent(dirName: string, meta: Frontmatter): IntentDeclaration {
  return {
    name: dirName,
    intent: meta.intent ?? dirName.replace(/-/g, "_"),
    description: meta.description,
    fields: meta.fields ?? {},
  };
}

export function loadWorkflowManifest(workflowDir: string): WorkflowManifest {
  const name = path.basename(workflowDir);
  const readme = readReadme(workflowDir);
  if (!readme) throw new Error(`No README.md in workflow dir: ${workflowDir}`);

  const workflowIntent = buildIntent(name, readme.meta);
  const executables = new Map<string, ExecutableManifest>();
  const taskLines: string[] = [];
  const toolLines: string[] = [];

  for (const taskName of listSubdirs(path.join(workflowDir, "tasks"))) {
    const taskDir = path.join(workflowDir, "tasks", taskName);
    const r = readReadme(taskDir);
    if (!r) continue;
    const intent = buildIntent(taskName, r.meta);
    executables.set(intent.intent, { kind: "task", intent, dir: taskDir });
    taskLines.push(`- ${taskName}: ${firstLine(r.body)}`);
  }

  for (const toolName of listSubdirs(path.join(workflowDir, "tools"))) {
    const toolDir = path.join(workflowDir, "tools", toolName);
    const r = readReadme(toolDir);
    if (!r) continue;
    const intent = buildIntent(toolName, r.meta);
    executables.set(intent.intent, { kind: "tool", intent, dir: toolDir });
    toolLines.push(`- ${toolName}: ${firstLine(r.body)}`);
  }

  const terminalIntents = [ClarificationRequest, DoneForNow] as const;

  const sections: ContextSection[] = [{ title: `Workflow: ${name}`, body: readme.body }];
  if (taskLines.length > 0) sections.push({ title: "Available Tasks", body: taskLines.join("\n") });
  if (toolLines.length > 0) sections.push({ title: "Available Tools", body: toolLines.join("\n") });

  const contract: IntentDeclaration[] = [
    ...terminalIntents,
    ...[...executables.values()].map((m) => m.intent),
  ];

  return { dir: workflowDir, name, intent: workflowIntent, terminalIntents, contract, sections, executables };
}
