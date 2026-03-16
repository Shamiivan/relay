import fs from "node:fs/promises";
import path from "node:path";
import type { RunDoc } from "../primitives/run";

export type RunTraceKind =
  | "run_started"
  | "session_messages"
  | "model_request"
  | "provider_request"
  | "model_response"
  | "tool_call"
  | "tool_result"
  | "workflow_handoff_to_open_loop"
  | "workflow_completed"
  | "workflow_step_completed"
  | "run_finished"
  | "run_failed";

function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

export function createTraceFilePath(traceDir: string): string {
  const now = new Date();
  const localTimestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-") + "_" + [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("-");

  return repoPath(path.join(traceDir, `${localTimestamp}.log`));
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function formatLoopHeader(kind: RunTraceKind, data: unknown): string {
  if (!data || typeof data !== "object" || !("turn" in data)) {
    return kind;
  }

  const turn = Reflect.get(data, "turn");
  return typeof turn === "number" ? `loop_${turn}.${kind}` : kind;
}

function formatTraceDetails(kind: RunTraceKind, data: unknown): string {
  if (!data || typeof data !== "object") {
    return formatValue(data);
  }

  if (kind === "session_messages") {
    const rendered = Reflect.get(data, "rendered");
    return typeof rendered === "string" ? rendered : formatValue(data);
  }

  if (kind === "model_request") {
    const toolNames = Reflect.get(data, "toolNames");
    const renderedMessages = Reflect.get(data, "renderedMessages");
    const lines = [
      `tools: ${Array.isArray(toolNames) ? toolNames.join(", ") : ""}`,
      "",
      "messages:",
      typeof renderedMessages === "string" ? renderedMessages : "",
    ];

    return lines.join("\n").trim();
  }

  if (kind === "model_response") {
    const renderedParts = Reflect.get(data, "renderedParts");
    return typeof renderedParts === "string" ? renderedParts : formatValue(data);
  }

  if (kind === "provider_request") {
    const payload = Reflect.get(data, "payload");
    return formatValue(payload);
  }

  if (kind === "tool_call") {
    const toolCall = Reflect.get(data, "toolCall");
    if (toolCall && typeof toolCall === "object") {
      const name = Reflect.get(toolCall, "name");
      const args = Reflect.get(toolCall, "args");
      return [
        `name: ${typeof name === "string" ? name : ""}`,
        "",
        "args:",
        formatValue(args),
      ].join("\n");
    }
  }

  if (kind === "tool_result") {
    const name = Reflect.get(data, "name");
    const result = Reflect.get(data, "result");
    return [
      `name: ${typeof name === "string" ? name : ""}`,
      "",
      formatValue(result),
    ].join("\n");
  }

  return formatValue(data);
}

function formatTraceBlock(kind: RunTraceKind, data: unknown): string {
  return [
    `=== ${formatLoopHeader(kind, data)} ===`,
    formatTraceDetails(kind, data),
    "",
  ].join("\n");
}

export async function initializeTraceFile(
  filePath: string,
  run: RunDoc,
  env: { MODEL_PROVIDER: string; MODEL_NAME: string },
  prompt: string,
  context: string,
): Promise<string> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const header = [
    `runId: ${run._id}`,
    `sessionId: ${run.sessionId}`,
    `userId: ${run.userId}`,
    `threadKey: ${run.threadKey}`,
    `transport: ${run.transport}`,
    `specialistId: ${run.specialistId}`,
    `modelProvider: ${env.MODEL_PROVIDER}`,
    `modelName: ${env.MODEL_NAME}`,
    `startedAt: ${new Date().toISOString()}`,
    "",
    "=== user_message ===",
    run.message,
    "",
    "=== prompt ===",
    prompt,
    "",
    "=== context ===",
    context,
    "",
  ].join("\n");
  await fs.writeFile(filePath, header, "utf8");
  return filePath;
}

export async function appendTraceEvent(
  traceFile: string,
  kind: RunTraceKind,
  data: unknown,
): Promise<void> {
  await fs.appendFile(traceFile, formatTraceBlock(kind, data), "utf8");
}
