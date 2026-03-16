import type { ConvexClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { SpecialistConfig } from "../../../packages/contracts/src";
import type { ModelResponse } from "../../../packages/model/src";
import { createModelAdapter } from "../../../packages/model/src/provider";
import { compileRunInput } from "../compile/compile-run-input";
import { formatCompiledMessages } from "../compile/replay-session-messages";
import type { RunDoc } from "../primitives/run";
import type { ToolCallDoc } from "../primitives/tool-call";
import { emitRuntimeEvent } from "../tracing/emit-event";
import { appendTraceEvent } from "../tracing/trace-file";
import { executeToolCall } from "../tools/execute-tool-call";
import { loadToolPrompt, type ToolManifest } from "../tools/tool-registry";

export type RuntimeEnv = {
  MODEL_PROVIDER: string;
  MODEL_NAME: string;
  GEMINI_API_KEY: string;
};

export type AgentLoopResult =
  | { status: "completed"; outputText: string }
  | { status: "waiting_on_human" };

function buildSystemInstruction(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

async function loadToolPromptSection(tools: ToolManifest[]): Promise<string> {
  const chunks = await Promise.all(
    tools.map(async (tool) => {
      const prompt = await loadToolPrompt(tool.name);
      if (!prompt) {
        return "";
      }

      return `# Tool: ${tool.name}\n${prompt}`;
    }),
  );

  return chunks.filter(Boolean).join("\n\n").trim();
}

function inferToolKind(toolName: string): "machine" | "human" {
  return toolName.startsWith("human.") ? "human" : "machine";
}

function isToolErrorResult(
  result: unknown,
): result is { error: { type?: unknown; message?: unknown } } {
  return Boolean(
    result &&
    typeof result === "object" &&
    "error" in result &&
    typeof (result as { error?: unknown }).error === "object",
  );
}

function summarizeModelResponse(response: ModelResponse): string {
  if (response.toolCalls.length > 0) {
    return `Model requested ${response.toolCalls.length} tool call(s).`;
  }

  if (response.text) {
    return "Model produced a final text response.";
  }

  return "Model responded without tool calls.";
}

function summarizeToolExecution(toolCalls: Array<{ name: string }>): string {
  return `Executed ${toolCalls.length} tool call(s): ${toolCalls.map((toolCall) => toolCall.name).join(", ")}`;
}

async function executeRegisteredTool(
  tool: ToolManifest | undefined,
  args: unknown,
): Promise<unknown> {
  if (!tool) {
    return {
      error: {
        type: "validation",
        field: "tool_name",
        reason: "Unknown tool",
      },
    };
  }

  try {
    return await executeToolCall(tool, args);
  } catch (error) {
    return {
      error: {
        type: "external_error",
        message: error instanceof Error ? error.message : "Unknown tool execution error",
      },
    };
  }
}

/**
 * Runs the current open-loop execution policy for one durable run.
 */
export async function runOpenLoop(params: {
  convex: ConvexClient;
  run: RunDoc;
  specialist: SpecialistConfig;
  allowedTools: ToolManifest[];
  env: RuntimeEnv;
  runLogger: {
    info: (message: string, data?: Record<string, unknown>) => void;
  };
  traceFile: string;
  baseSystemInstruction: string;
}): Promise<AgentLoopResult> {
  const { convex, run, specialist, allowedTools, env, runLogger, traceFile, baseSystemInstruction } =
    params;
  const adapter = createModelAdapter(env);
  const toolsByName = new Map(
    allowedTools.map((tool) => [tool.name, tool] as const),
  );
  const activatedToolNames = new Set<string>();
  const sessionMessages = await convex.query(api.sessionMessages.getRecentBySession, {
    sessionId: run.sessionId,
    limit: 200,
  });
  let runSteps = await convex.query(api.runSteps.listByRun, {
    runId: run._id,
  });
  let toolCalls = await convex.query(api.toolCalls.listByRun, {
    runId: run._id,
  });
  await appendTraceEvent(traceFile, "run_started", {
    timestamp: new Date().toISOString(),
    turnCount: run.turnCount,
    historyEventCount: sessionMessages.length,
    systemInstruction: baseSystemInstruction,
  });

  for (let turn = 0; turn < specialist.maxTurns; turn += 1) {
    const activatedTools = allowedTools.filter((tool) =>
      activatedToolNames.has(tool.name),
    );
    const toolPromptSection = await loadToolPromptSection(activatedTools);
    const systemInstruction = buildSystemInstruction([
      baseSystemInstruction,
      toolPromptSection,
    ]);
    const compiled = compileRunInput({
      sessionMessages,
      currentRunId: run._id,
      runSteps,
      toolCalls,
      systemInstruction,
      tools: allowedTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    });
    adapter.validate(compiled.messages);

    runLogger.info("model_turn_started", {
      turn: turn + 1,
      modelProvider: env.MODEL_PROVIDER,
      modelName: env.MODEL_NAME,
    });
    await appendTraceEvent(traceFile, "session_messages", {
      timestamp: new Date().toISOString(),
      turn: turn + 1,
      messageCount: compiled.messages.length,
      rendered: formatCompiledMessages(compiled.messages),
    });

    const modelStepId = await convex.mutation(api.runSteps.create, {
      runId: run._id,
      sessionId: run.sessionId,
      index: turn * 2,
      kind: "model_response",
      modelRequestJson: JSON.stringify(compiled),
      summaryText: `Turn ${turn + 1} model request.`,
    });
    await emitRuntimeEvent(convex, {
      sessionId: run.sessionId,
      runId: run._id,
      runStepId: modelStepId,
      kind: "model.requested",
      data: {
        turn: turn + 1,
        toolNames: compiled.tools.map((tool) => tool.name),
      },
    });
    await appendTraceEvent(traceFile, "model_request", {
      timestamp: new Date().toISOString(),
      turn: turn + 1,
      toolNames: compiled.tools.map((tool) => tool.name),
      renderedMessages: formatCompiledMessages(compiled.messages),
    });
    await appendTraceEvent(traceFile, "provider_request", {
      timestamp: new Date().toISOString(),
      turn: turn + 1,
      payload: adapter.toProviderPayload(compiled),
    });

    let response: ModelResponse;
    try {
      response = await adapter.generate(compiled);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Model request failed";
      await convex.mutation(api.runSteps.fail, {
        stepId: modelStepId,
        errorType: "model_error",
        errorMessage: message,
      });
      throw error;
    }

    await convex.mutation(api.runSteps.complete, {
      stepId: modelStepId,
      modelResponseJson: JSON.stringify(response),
      summaryText: summarizeModelResponse(response),
    });
    await emitRuntimeEvent(convex, {
      sessionId: run.sessionId,
      runId: run._id,
      runStepId: modelStepId,
      kind: "model.responded",
      data: {
        turn: turn + 1,
        toolCallCount: response.toolCalls.length,
        hasText: Boolean(response.text),
      },
    });
    await appendTraceEvent(traceFile, "model_response", {
      timestamp: new Date().toISOString(),
      turn: turn + 1,
      renderedParts: formatCompiledMessages([{ role: "model", parts: response.parts }]),
      response,
    });
    runSteps = await convex.query(api.runSteps.listByRun, {
      runId: run._id,
    });

    if (response.toolCalls.length === 0) {
      if (response.text) {
        return {
          status: "completed",
          outputText: response.text,
        };
      }

      break;
    }

    const toolStepId = await convex.mutation(api.runSteps.create, {
      runId: run._id,
      sessionId: run.sessionId,
      index: turn * 2 + 1,
      kind: "tool_execution",
      toolRequestsJson: JSON.stringify(response.toolCalls),
      summaryText: summarizeToolExecution(response.toolCalls),
    });

    const toolResults = await Promise.all(
      response.toolCalls.map(async (toolCall, toolCallIndex) => {
        const tool = toolsByName.get(toolCall.name);
        const toolKind = inferToolKind(toolCall.name);
        if (tool) {
          activatedToolNames.add(tool.name);
        }
        const toolCallId = await convex.mutation(api.toolCalls.create, {
          runId: run._id,
          sessionId: run.sessionId,
          runStepId: toolStepId,
          index: turn * 100 + toolCallIndex,
          toolName: toolCall.name,
          toolKind,
          argsJson: JSON.stringify(toolCall.args),
          pendingRequestJson:
            toolKind === "human"
              ? JSON.stringify({
                toolName: toolCall.name,
                args: toolCall.args,
              })
              : undefined,
        });
        await emitRuntimeEvent(convex, {
          sessionId: run.sessionId,
          runId: run._id,
          runStepId: toolStepId,
          toolCallId,
          kind: "tool.called",
          data: {
            turn: turn + 1,
            toolName: toolCall.name,
            toolKind,
            args: toolCall.args,
          },
        });
        await appendTraceEvent(traceFile, "tool_call", {
          timestamp: new Date().toISOString(),
          toolCall,
        });

        if (toolKind === "human") {
          await convex.mutation(api.runs.setWaitingOnHuman, {
            runId: run._id,
          });
          await emitRuntimeEvent(convex, {
            sessionId: run.sessionId,
            runId: run._id,
            runStepId: toolStepId,
            toolCallId,
            kind: "run.waiting_for_human",
            data: {
              turn: turn + 1,
              toolName: toolCall.name,
            },
          });

          return {
            name: toolCall.name,
            result: { pending: true },
            waitingOnHuman: true,
          };
        }

        const result = await executeRegisteredTool(tool, toolCall.args);
        if (isToolErrorResult(result)) {
          await convex.mutation(api.toolCalls.fail, {
            toolCallId,
            errorType:
              typeof result.error.type === "string" ? result.error.type : "tool_error",
            errorMessage:
              typeof result.error.message === "string"
                ? result.error.message
                : JSON.stringify(result.error),
          });
          await emitRuntimeEvent(convex, {
            sessionId: run.sessionId,
            runId: run._id,
            runStepId: toolStepId,
            toolCallId,
            kind: "tool.failed",
            data: {
              turn: turn + 1,
              toolName: toolCall.name,
              error: result.error,
            },
          });
        } else {
          await convex.mutation(api.toolCalls.complete, {
            toolCallId,
            resultJson: JSON.stringify(result),
          });
          await emitRuntimeEvent(convex, {
            sessionId: run.sessionId,
            runId: run._id,
            runStepId: toolStepId,
            toolCallId,
            kind: "tool.completed",
            data: {
              turn: turn + 1,
              toolName: toolCall.name,
            },
          });
        }
        await appendTraceEvent(traceFile, "tool_result", {
          timestamp: new Date().toISOString(),
          name: toolCall.name,
          result,
        });

        return {
          name: toolCall.name,
          result,
        };
      }),
    );

    await convex.mutation(api.runSteps.complete, {
      stepId: toolStepId,
      toolResultsJson: JSON.stringify(
        toolResults.map(({ name, result, waitingOnHuman }) => ({
          name,
          result,
          waitingOnHuman: Boolean(waitingOnHuman),
        })),
      ),
      summaryText: summarizeToolExecution(response.toolCalls),
    });
    runSteps = await convex.query(api.runSteps.listByRun, {
      runId: run._id,
    });
    toolCalls = await convex.query(api.toolCalls.listByRun, {
      runId: run._id,
    });

    if (toolResults.some((toolResult) => toolResult.waitingOnHuman)) {
      return {
        status: "waiting_on_human",
      };
    }
  }

  throw new Error("Model loop ended without a final response.");
}
