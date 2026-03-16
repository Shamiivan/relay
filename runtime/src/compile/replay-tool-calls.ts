import type { ModelMessage } from "../../../packages/model/src";
import type { ToolCallDoc } from "../primitives/tool-call";

function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

export function buildCompletedToolResultMessage(toolCalls: ToolCallDoc[]): ModelMessage | null {
  const completedToolCalls = toolCalls.filter(
    (toolCall) => toolCall.status === "completed" && toolCall.resultJson,
  );

  if (completedToolCalls.length === 0) {
    return null;
  }

  return {
    role: "user",
    parts: completedToolCalls.map((toolCall) => ({
      type: "tool_result" as const,
      name: toolCall.toolName,
      result: parseJson<unknown>(toolCall.resultJson!),
    })),
  };
}
