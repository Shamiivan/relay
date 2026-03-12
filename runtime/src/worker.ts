/**
 * Local worker that claims pending runs and executes them.
 * This keeps provider SDKs and filesystem access out of Convex.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  gmail,
  gmailToolDeclarations,
  readInput,
  searchInput,
  searchSenderInput,
} from "../../packages/adapters/gmail/src";
import type { GmailEnv, SpecialistConfig } from "../../packages/contracts/src";
import { specialistConfigSchema } from "../../packages/contracts/src";
import { createLogger } from "../../packages/logger/src";
import { createModelClient } from "../../packages/model/src/provider";
import type { ModelMessage } from "../../packages/model/src";
import { loadRuntimeEnv } from "./env";

function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

async function loadSpecialistConfig(specialistId: string): Promise<SpecialistConfig> {
  const raw = await fs.readFile(
    repoPath(`configs/specialists/${specialistId}.json`),
    "utf8",
  );

  return specialistConfigSchema.parse(JSON.parse(raw));
}

async function loadPrompt(promptFile: string): Promise<string> {
  return await fs.readFile(repoPath(promptFile), "utf8");
}

async function loadContext(contextFiles: string[]): Promise<string> {
  const chunks = await Promise.all(
    contextFiles.map(async (file) => {
      const content = await fs.readFile(repoPath(file), "utf8");
      return `# ${file}\n${content.trim()}`;
    }),
  );

  return chunks.join("\n\n").trim();
}

type RuntimeEnv = GmailEnv & {
  LOG_LEVEL: string;
  TRACE_DIR: string;
  MODEL_PROVIDER: string;
  MODEL_NAME: string;
  GEMINI_API_KEY: string;
};

type RunTraceKind =
  | "run_started"
  | "model_request"
  | "model_response"
  | "tool_call"
  | "tool_result"
  | "run_finished"
  | "run_failed";

function createTraceFilePath(traceDir: string, runId: string): string {
  return repoPath(path.join(traceDir, `${new Date().toISOString().replaceAll(":", "-")}_${runId}.log`));
}

function formatTraceBlock(kind: RunTraceKind, data: unknown): string {
  return [
    `=== ${kind} ===`,
    JSON.stringify(data, null, 2),
    "",
  ].join("\n");
}

function parseJsonSafely(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

type ThreadEventDoc = Doc<"threadEvents">;

function buildHistoryMessages(events: ThreadEventDoc[], currentRunId: Id<"runs">): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (const event of events) {
    if (event.runId === currentRunId && event.kind === "user_message") {
      continue;
    }

    if (event.kind === "user_message") {
      messages.push({
        role: "user",
        parts: [{ type: "text", text: event.text }],
      });
      continue;
    }

    if (event.kind === "agent_output") {
      messages.push({
        role: "model",
        parts: [{ type: "text", text: event.text }],
      });
      continue;
    }

    if (event.kind === "tool_call") {
      const data = parseJsonSafely(event.text) as { name?: string; args?: unknown };
      if (!data || typeof data !== "object" || typeof data.name !== "string") {
        continue;
      }

      messages.push({
        role: "model",
        parts: [{ type: "tool_call", name: data.name, args: data.args ?? {} }],
      });
      continue;
    }

    if (event.kind === "tool_result") {
      const data = parseJsonSafely(event.text) as { name?: string; result?: unknown };
      if (!data || typeof data !== "object" || typeof data.name !== "string") {
        continue;
      }

      messages.push({
        role: "user",
        parts: [{ type: "tool_result", name: data.name, result: data.result }],
      });
      continue;
    }

    if (event.kind === "run_error") {
      messages.push({
        role: "model",
        parts: [{ type: "text", text: `Previous error: ${event.text}` }],
      });
    }
  }

  return messages;
}

async function initializeTraceFile(
  traceDir: string,
  run: Doc<"runs">,
  env: RuntimeEnv,
  prompt: string,
  context: string,
): Promise<string> {
  const filePath = createTraceFilePath(traceDir, run._id);
  await fs.mkdir(repoPath(traceDir), { recursive: true });
  const header = [
    `runId: ${run._id}`,
    `threadId: ${run.threadId}`,
    `userId: ${run.userId}`,
    `channelId: ${run.channelId}`,
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

async function appendTraceEvent(
  traceFile: string,
  kind: RunTraceKind,
  data: unknown,
): Promise<void> {
  await fs.appendFile(traceFile, formatTraceBlock(kind, data), "utf8");
}

async function executeToolCall(
  name: string,
  args: unknown,
  env: GmailEnv,
): Promise<unknown> {
  if (name === "gmail_search") {
    const result = await gmail.actions.search.execute(searchInput.parse(args), env);
    return result.ok ? result.data : { error: result.error };
  }

  if (name === "gmail_read") {
    const result = await gmail.actions.read.execute(readInput.parse(args), env);
    return result.ok ? result.data : { error: result.error };
  }

  if (name === "gmail_search_sender") {
    const result = await gmail.actions.searchSender.execute(searchSenderInput.parse(args), env);
    return result.ok ? result.data : { error: result.error };
  }

  return {
    error: {
      type: "validation",
      field: "tool_name",
      reason: `Unknown tool: ${name}`,
    },
  };
}

async function runAgentLoop(
  convex: ConvexClient,
  run: Doc<"runs">,
  specialist: SpecialistConfig,
  env: RuntimeEnv,
  runLogger: ReturnType<typeof createLogger>,
  traceFile: string,
  systemInstruction: string,
): Promise<string> {
  const client = createModelClient(env);
  const historyEvents = await convex.query(api.threadEvents.getRecentByThread, {
    threadId: run.threadId,
    limit: 30,
  });
  const messages: ModelMessage[] = [
    ...buildHistoryMessages(historyEvents, run._id),
    {
      role: "user",
      parts: [{ type: "text", text: run.message }],
    },
  ];
  await appendTraceEvent(traceFile, "run_started", {
    timestamp: new Date().toISOString(),
    turnCount: run.turnCount,
    historyEventCount: historyEvents.length,
    systemInstruction,
  });
  for (let turn = 0; turn < specialist.maxTurns; turn += 1) {
    runLogger.info("model_turn_started", {
      turn: turn + 1,
      modelProvider: env.MODEL_PROVIDER,
      modelName: env.MODEL_NAME,
    });

    const request = {
      systemInstruction,
      messages,
      tools: [...gmailToolDeclarations],
    };
    await appendTraceEvent(traceFile, "model_request", {
      timestamp: new Date().toISOString(),
      turn: turn + 1,
      request,
    });

    const response = await client.generate(request);

    runLogger.info("model_turn_completed", {
      turn: turn + 1,
      toolCallCount: response.toolCalls.length,
      hasText: Boolean(response.text),
    });
    await appendTraceEvent(traceFile, "model_response", {
      timestamp: new Date().toISOString(),
      turn: turn + 1,
      response,
    });

    if (response.parts.length > 0) {
      messages.push({
        role: "model",
        parts: response.parts,
      });
    }

    if (response.toolCalls.length === 0) {
      if (response.text) {
        return response.text;
      }

      break;
    }

    const toolResults = await Promise.all(
      response.toolCalls.map(async (toolCall) => {
        runLogger.info("tool_call_started", {
          toolName: toolCall.name,
          toolArgs: toolCall.args,
        });
        await appendTraceEvent(traceFile, "tool_call", {
          timestamp: new Date().toISOString(),
          toolCall,
        });

        await convex.mutation(api.threadEvents.append, {
          threadId: run.threadId,
          runId: run._id,
          kind: "tool_call",
          text: JSON.stringify(toolCall),
        });

        const result = await executeToolCall(toolCall.name, toolCall.args, env);
        runLogger.info("tool_call_completed", {
          toolName: toolCall.name,
          toolResult: result,
        });
        await appendTraceEvent(traceFile, "tool_result", {
          timestamp: new Date().toISOString(),
          name: toolCall.name,
          result,
        });
        await convex.mutation(api.threadEvents.append, {
          threadId: run.threadId,
          runId: run._id,
          kind: "tool_result",
          text: JSON.stringify({
            name: toolCall.name,
            result,
          }),
        });

        return {
          name: toolCall.name,
          result,
        };
      }),
    );

    messages.push({
      role: "user",
      parts: toolResults.map((toolResult) => ({
        type: "tool_result" as const,
        name: toolResult.name,
        result: toolResult.result,
      })),
    });
  }

  throw new Error("Model loop ended without a final response.");
}

async function processRun(
  convex: ConvexClient,
  run: Doc<"runs">,
  env: RuntimeEnv,
  processLogger: ReturnType<typeof createLogger>,
): Promise<void> {
  const runLogger = processLogger.child({
    runId: run._id,
    specialistId: run.specialistId,
    userId: run.userId,
  });

  try {
    runLogger.info("run_started", {
      message: run.message,
      turnCount: run.turnCount,
    });
    const specialist = await loadSpecialistConfig(run.specialistId);
    const prompt = await loadPrompt(specialist.promptFile);
    const context = await loadContext(specialist.contextFiles);
    const systemInstruction = [prompt.trim(), context.trim()]
      .filter(Boolean)
      .join("\n\n");
    const traceFile = await initializeTraceFile(
      env.TRACE_DIR,
      run,
      env,
      prompt,
      context,
    );
    const outputText = await runAgentLoop(
      convex,
      run,
      specialist,
      env,
      runLogger,
      traceFile,
      systemInstruction,
    );
    await convex.mutation(api.threadEvents.append, {
      threadId: run.threadId,
      runId: run._id,
      kind: "agent_output",
      text: outputText,
    });
    await convex.mutation(api.runs.finish, {
      runId: run._id,
      outputText,
    });
    await appendTraceEvent(traceFile, "run_finished", {
      timestamp: new Date().toISOString(),
      outputText,
    });
    runLogger.info("run_finished", {
      outputText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker failure";
    await convex.mutation(api.threadEvents.append, {
      threadId: run.threadId,
      runId: run._id,
      kind: "run_error",
      text: message,
    });
    await convex.mutation(api.runs.fail, {
      runId: run._id,
      errorType: "internal_error",
      errorMessage: message,
    });
    const existingTraceFiles = await fs
      .readdir(repoPath(env.TRACE_DIR))
      .then((entries) =>
        entries
          .filter((entry) => entry.endsWith(`_${run._id}.log`))
          .sort()
          .map((entry) => repoPath(path.join(env.TRACE_DIR, entry))),
      )
      .catch(() => []);
    const traceFile = existingTraceFiles.at(-1) ?? createTraceFilePath(env.TRACE_DIR, run._id);
    try {
      await fs.access(traceFile);
      await appendTraceEvent(traceFile, "run_failed", {
        timestamp: new Date().toISOString(),
        message,
      });
    } catch {
      const prompt = "";
      const context = "";
      await initializeTraceFile(env.TRACE_DIR, run, env, prompt, context);
      await appendTraceEvent(traceFile, "run_failed", {
        timestamp: new Date().toISOString(),
        message,
      });
    }
    runLogger.error("run_failed", {
      error,
    });
  }
}

export function startWorker(): void {
  const env = loadRuntimeEnv();
  const processLogger = createLogger({
    level: env.LOG_LEVEL,
    service: "worker",
  });
  const convex = new ConvexClient(env.CONVEX_URL);

  convex.onUpdate(api.runs.listTodo, {}, async (pendingRuns) => {
    if (pendingRuns.length === 0) {
      return;
    }

    processLogger.info("pending_runs_detected", {
      count: pendingRuns.length,
    });

    for (;;) {
      const run = await convex.mutation(api.runs.claim, {});
      if (!run) {
        break;
      }

      processLogger.info("run_claimed", {
        runId: run._id,
      });
      await processRun(convex, run, env, processLogger);
    }
  });

  processLogger.info("worker_started", {
    modelProvider: env.MODEL_PROVIDER,
    modelName: env.MODEL_NAME,
  });
}

startWorker();
