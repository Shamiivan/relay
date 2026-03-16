import type { ModelMessage, ModelTool } from "../../../packages/model/src";
import type { RunId } from "../primitives/run";
import type { RunStepDoc } from "../primitives/run-step";
import type { SessionMessageDoc } from "../primitives/session";
import type { ToolCallDoc } from "../primitives/tool-call";
import { buildRecentSessionMessages } from "./replay-session-messages";
import { replayRunSteps } from "./replay-run-steps";

export type CompiledRunInput = {
  systemInstruction: string;
  messages: ModelMessage[];
  tools: ModelTool[];
};

/**
 * Compiles one model request from visible session history plus durable runtime records.
 */
export function compileRunInput(params: {
  sessionMessages: SessionMessageDoc[];
  currentRunId: RunId;
  runSteps: RunStepDoc[];
  toolCalls: ToolCallDoc[];
  systemInstruction: string;
  tools: ModelTool[];
}): CompiledRunInput {
  return {
    systemInstruction: params.systemInstruction,
    messages: [
      ...buildRecentSessionMessages(params.sessionMessages, params.currentRunId),
      ...replayRunSteps(params.runSteps, params.toolCalls),
    ],
    tools: params.tools,
  };
}
