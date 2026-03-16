import type { ModelMessage, ModelResponse } from "../../../packages/model/src";
import type { RunStepDoc } from "../primitives/run-step";
import type { ToolCallDoc } from "../primitives/tool-call";
import { buildCompletedToolResultMessage } from "./replay-tool-calls";

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

/**
 * Replays runtime execution records back into model-facing messages.
 */
export function replayRunSteps(
  runSteps: RunStepDoc[],
  toolCalls: ToolCallDoc[],
): ModelMessage[] {
  const messages: ModelMessage[] = [];
  const toolCallsByStepId = new Map<string, ToolCallDoc[]>();

  for (const toolCall of toolCalls) {
    if (!toolCall.runStepId) {
      continue;
    }

    const stepId = toolCall.runStepId as string;
    const calls = toolCallsByStepId.get(stepId) ?? [];
    calls.push(toolCall);
    toolCallsByStepId.set(stepId, calls);
  }

  for (const step of runSteps) {
    if (step.status !== "completed") {
      continue;
    }

    if (step.kind === "model_response" && step.modelResponseJson) {
      const response = parseJson<ModelResponse>(step.modelResponseJson);
      if (response.parts.length > 0) {
        messages.push({
          role: "model",
          parts: response.parts,
        });
      }
      continue;
    }

    const toolResultMessage = buildCompletedToolResultMessage(
      toolCallsByStepId.get(step._id as string) ?? [],
    );
    if (toolResultMessage) {
      messages.push(toolResultMessage);
    }
  }

  return messages;
}
