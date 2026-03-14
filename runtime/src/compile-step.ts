import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { ModelMessage, ModelTool } from "../../packages/model/src";
import { buildRecentThreadMessages } from "./thread";

type ThreadMessageDoc = Doc<"threadMessages">;
type RunStepDoc = Doc<"runSteps">;

export type CompiledStep = {
  systemInstruction: string;
  messages: ModelMessage[];
  tools: ModelTool[];
};

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

function buildRunStepMessages(runSteps: RunStepDoc[]): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (const step of runSteps) {
    if (step.status !== "completed" || !step.outputJson) {
      continue;
    }

    if (step.kind === "model") {
      const output = parseJson<{ response?: { parts?: ModelMessage["parts"] } }>(step.outputJson);
      const parts = output.response?.parts ?? [];
      if (parts.length > 0) {
        messages.push({
          role: "model",
          parts,
        });
      }
      continue;
    }

    const output = parseJson<{ toolResults?: Array<{ name: string; result: unknown }> }>(
      step.outputJson,
    );
    const toolResults = output.toolResults ?? [];
    if (toolResults.length > 0) {
      messages.push({
        role: "user",
        parts: toolResults.map((toolResult) => ({
          type: "tool_result" as const,
          name: toolResult.name,
          result: toolResult.result,
        })),
      });
    }
  }

  return messages;
}

export function compileStep(params: {
  threadMessages: ThreadMessageDoc[];
  currentRunId: Id<"runs">;
  runSteps: RunStepDoc[];
  systemInstruction: string;
  tools: ModelTool[];
}): CompiledStep {
  return {
    systemInstruction: params.systemInstruction,
    messages: [
      ...buildRecentThreadMessages(params.threadMessages, params.currentRunId),
      ...buildRunStepMessages(params.runSteps),
    ],
    tools: params.tools,
  };
}
