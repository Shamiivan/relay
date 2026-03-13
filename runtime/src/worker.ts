/**
 * Local worker that claims pending runs and executes them.
 * This keeps provider SDKs and filesystem access out of Convex.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { providers } from "../../packages/adapters/src";
import type { GmailEnv, SpecialistConfig, ToolAction } from "../../packages/contracts/src";
import { specialistConfigSchema } from "../../packages/contracts/src";
import { createLogger } from "../../packages/logger/src";
import { createModelClient } from "../../packages/model/src/provider";
import type { ModelMessage } from "../../packages/model/src";
import { loadRuntimeEnv } from "./env";
import { buildRecentThreadMessages, formatThreadMessages } from "./thread";

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
  | "thread_messages"
  | "model_request"
  | "provider_request"
  | "model_response"
  | "tool_call"
  | "tool_result"
  | "run_finished"
  | "run_failed";

type RuntimeToolAction = ToolAction<RuntimeEnv>;

function createTraceFilePath(traceDir: string): string {
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

  if (kind === "thread_messages") {
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
    const parsedArgs = Reflect.get(data, "parsedArgs");
    if (toolCall && typeof toolCall === "object") {
      const name = Reflect.get(toolCall, "name");
      const args = Reflect.get(toolCall, "args");
      return [
        `name: ${typeof name === "string" ? name : ""}`,
        "",
        "raw args:",
        formatValue(args),
        "",
        "parsed args:",
        formatValue(parsedArgs),
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

async function initializeTraceFile(
  filePath: string,
  run: Doc<"runs">,
  env: RuntimeEnv,
  prompt: string,
  context: string,
): Promise<string> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
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

function getAllowedActions(specialist: SpecialistConfig): RuntimeToolAction[] {
  return specialist.tools.flatMap((toolId) => {
    const provider = providers[toolId as keyof typeof providers];
    if (!provider) {
      throw new Error(`Unknown provider in specialist config: ${toolId}`);
    }

    return Object.values(provider.actions) as RuntimeToolAction[];
  });
}

async function executeToolCall(
  action: RuntimeToolAction | undefined,
  args: unknown,
  env: RuntimeEnv,
): Promise<unknown> {
  if (action) {
    const result = await action.execute(args, env);
    return result.ok ? result.data : { error: result.error };
  }

  return {
    error: {
      type: "validation",
      field: "tool_name",
      reason: "Unknown tool",
    },
  };
}

function inspectToolInput(action: RuntimeToolAction | undefined, args: unknown): unknown {
  if (!action?.inspectInput) {
    return null;
  }

  try {
    return action.inspectInput(args);
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : "Unknown parse error",
    };
  }
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
  const allowedActions = getAllowedActions(specialist);
  const actionsByName = new Map(
    allowedActions.map((action) => [action.name, action] as const),
  );
  const historyEvents = await convex.query(api.threadEvents.getRecentByThread, {
    threadId: run.threadId,
    limit: 200,
  });
  const messages: ModelMessage[] = [
    ...buildRecentThreadMessages(historyEvents, run._id),
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
  await appendTraceEvent(traceFile, "thread_messages", {
    timestamp: new Date().toISOString(),
    turn: 1,
    messageCount: messages.length,
    rendered: formatThreadMessages(messages),
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
      tools: allowedActions.map((action) => ({
        name: action.name,
        description: action.description,
        parameters: action.parameters,
      })),
    };
    await appendTraceEvent(traceFile, "model_request", {
      timestamp: new Date().toISOString(),
      turn: turn + 1,
      toolNames: request.tools.map((tool) => tool.name),
      renderedMessages: formatThreadMessages(messages),
      request,
    });
    await appendTraceEvent(traceFile, "provider_request", {
      timestamp: new Date().toISOString(),
      turn: turn + 1,
      payload: client.toProviderPayload(request),
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
      renderedParts: formatThreadMessages([
        {
          role: "model",
          parts: response.parts,
        },
      ]),
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
        const action = actionsByName.get(toolCall.name);
        const parsedArgs = inspectToolInput(action, toolCall.args);
        runLogger.info("tool_call_started", {
          toolName: toolCall.name,
          toolArgs: toolCall.args,
          parsedArgs,
        });
        await appendTraceEvent(traceFile, "tool_call", {
          timestamp: new Date().toISOString(),
          toolCall,
          parsedArgs,
        });

        await convex.mutation(api.threadEvents.append, {
          threadId: run.threadId,
          runId: run._id,
          kind: "tool_call",
          text: JSON.stringify(toolCall),
        });

        const result = await executeToolCall(action, toolCall.args, env);
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
  const traceFile = createTraceFilePath(env.TRACE_DIR);

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
    await initializeTraceFile(
      traceFile,
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
    try {
      await fs.access(traceFile);
      await appendTraceEvent(traceFile, "run_failed", {
        timestamp: new Date().toISOString(),
        message,
      });
    } catch {
      const prompt = "";
      const context = "";
      await initializeTraceFile(traceFile, run, env, prompt, context);
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
