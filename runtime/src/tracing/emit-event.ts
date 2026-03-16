import type { ConvexClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { RunId } from "../primitives/run";
import type { RunStepId } from "../primitives/run-step";
import type { SessionId } from "../primitives/session";
import type { ToolCallId } from "../primitives/tool-call";

/**
 * Appends one durable runtime event to Convex.
 */
export async function emitRuntimeEvent(
  convex: ConvexClient,
  params: {
    sessionId: SessionId;
    runId?: RunId;
    runStepId?: RunStepId;
    toolCallId?: ToolCallId;
    kind: string;
    data: unknown;
  },
): Promise<void> {
  await convex.mutation(api.events.append, {
    sessionId: params.sessionId,
    runId: params.runId,
    runStepId: params.runStepId,
    toolCallId: params.toolCallId,
    kind: params.kind,
    dataJson: JSON.stringify(params.data),
  });
}
