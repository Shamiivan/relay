import { z } from "zod";
import { defineTask, runDeclaredTask } from "../sdk";
import type { TaskErrorInfo } from "../sdk";
import { writeWorkspaceFile } from "../../tools/file/file.write/tool";
import { FileToolError } from "../../tools/file/lib";

const featureRequestSchema = z.object({
  title: z.string().min(1),
  problem: z.string().min(1),
  context: z.string().default(""),
  proposed_change: z.string().min(1),
  acceptance_criteria: z.array(z.string().min(1)).min(1),
  possible_tests: z.array(z.string().min(1)).default([]),
});

const inputSchema = featureRequestSchema.extend({
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
    .slice(0, 80) || "feature-request";
}

function formatSection(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}`;
}

function formatListSection(title: string, items: string[]): string {
  const body = items.map((item) => `- ${item}`).join("\n");
  return `## ${title}\n\n${body}`;
}

function renderFeatureRequest(
  request: z.output<typeof featureRequestSchema>,
): string {
  const sections = [
    `# Feature Request: ${request.title.trim()}`,
    formatSection("Problem", request.problem),
  ];

  if (request.context.trim()) {
    sections.push(formatSection("Context", request.context));
  }

  sections.push(formatSection("Proposed Change", request.proposed_change));
  sections.push(formatListSection("Acceptance Criteria", request.acceptance_criteria));

  if (request.possible_tests.length > 0) {
    sections.push(formatListSection("Possible Tests", request.possible_tests));
  }

  return `${sections.join("\n\n")}\n`;
}

function defaultDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const featureRequestCreateTask = defineTask({
  moduleUrl: import.meta.url,
  name: "feature_request.create",
  description: "Create a feature request markdown file under AGENTS/feature_requests from structured fields.",
  input: inputSchema,
  output: outputSchema,
  prompt: { files: [] },
  async handler({ input }) {
    const request = featureRequestSchema.parse(input);
    const fileName = `${input.date ?? defaultDate()}-${slugify(request.title)}.md`;
    const result = await writeWorkspaceFile({
      path: `AGENTS/feature_requests/${fileName}`,
      content: renderFeatureRequest(request),
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
      type: "feature_request_create_failed",
      message: error instanceof Error ? error.message : "Unknown feature request create error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTask(featureRequestCreateTask);
}
