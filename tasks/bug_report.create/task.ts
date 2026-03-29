import { z } from "zod";
import { defineTask, runDeclaredTask } from "../sdk";
import type { TaskErrorInfo } from "../sdk";
import { writeWorkspaceFile } from "../../tools/file/file.write/tool";
import { FileToolError } from "../../tools/file/lib";

const bugReportSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  repro: z.string().min(1),
  expected: z.string().default(""),
  version: z.string().default(""),
});

const inputSchema = bugReportSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const outputSchema = z.object({
  path: z.string(),
  terminal: z.object({
    status: z.literal("complete"),
    instruction: z.literal("Call done_for_now next."),
  }),
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80) || "bug-report";
}

function formatSection(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}`;
}

function defaultDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function renderBugReport(report: z.output<typeof bugReportSchema>): string {
  const sections = [
    `# Bug Report: ${report.title.trim()}`,
    formatSection("What happened?", report.description),
    formatSection("Steps to reproduce", report.repro),
  ];

  if (report.expected.trim()) {
    sections.push(formatSection("Expected behavior", report.expected));
  }

  if (report.version.trim()) {
    sections.push(formatSection("Version", report.version));
  }

  return `${sections.join("\n\n")}\n`;
}

export const bugReportCreateTask = defineTask({
  moduleUrl: import.meta.url,
  name: "bug_report.create",
  description: "Create a bug report markdown file under AGENTS/bug_report from structured fields.",
  input: inputSchema,
  output: outputSchema,
  prompt: { files: [] },
  async handler({ input }) {
    const report = bugReportSchema.parse(input);
    const fileName = `${input.date ?? defaultDate()}-${slugify(report.title)}.md`;
    const result = await writeWorkspaceFile({
      path: `AGENTS/bug_report/${fileName}`,
      content: renderBugReport(report),
      mode: "create",
    });
    return {
      path: result.path,
      terminal: {
        status: "complete",
        instruction: "Call done_for_now next.",
      },
    };
  },
  onError(error): TaskErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof FileToolError) {
      return { type: error.type, message: error.message };
    }
    return {
      type: "bug_report_create_failed",
      message: error instanceof Error ? error.message : "Unknown bug report create error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTask(bugReportCreateTask);
}
