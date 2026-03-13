import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { ModelMessage } from "../../packages/model/src";

export type ThreadEventDoc = Doc<"threadEvents">;

function parseJsonSafely(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isUserTextMessage(message: ModelMessage): boolean {
  return (
    message.role === "user" &&
    message.parts.some((part) => part.type === "text")
  );
}

function trimToRecentUserTurns(messages: ModelMessage[], maxUserTurns: number): ModelMessage[] {
  const userTurnIndexes = messages
    .map((message, index) => (isUserTextMessage(message) ? index : -1))
    .filter((index) => index >= 0);

  if (userTurnIndexes.length === 0) {
    return [];
  }

  const startIndex =
    userTurnIndexes.length > maxUserTurns
      ? userTurnIndexes[userTurnIndexes.length - maxUserTurns]
      : userTurnIndexes[0];

  return messages.slice(startIndex);
}

/**
 * Projects raw thread events into model-facing turns.
 * Consecutive tool calls and tool results are grouped so replay stays valid.
 */
export function buildThreadMessages(
  events: ThreadEventDoc[],
  currentRunId: Id<"runs">,
): ModelMessage[] {
  const messages: ModelMessage[] = [];
  let pendingModelParts: ModelMessage["parts"] = [];
  let pendingUserParts: ModelMessage["parts"] = [];

  function flushModelParts(): void {
    if (pendingModelParts.length === 0) {
      return;
    }

    messages.push({
      role: "model",
      parts: pendingModelParts,
    });
    pendingModelParts = [];
  }

  function flushUserParts(): void {
    if (pendingUserParts.length === 0) {
      return;
    }

    messages.push({
      role: "user",
      parts: pendingUserParts,
    });
    pendingUserParts = [];
  }

  for (const event of events) {
    if (event.runId === currentRunId && event.kind === "user_message") {
      continue;
    }

    if (event.kind === "user_message") {
      flushModelParts();
      flushUserParts();
      pendingUserParts.push({ type: "text", text: event.text });
      flushUserParts();
      continue;
    }

    if (event.kind === "agent_output") {
      flushUserParts();
      pendingModelParts.push({ type: "text", text: event.text });
      flushModelParts();
      continue;
    }

    if (event.kind === "tool_call") {
      const data = parseJsonSafely(event.text) as { name?: string; args?: unknown };
      if (!data || typeof data !== "object" || typeof data.name !== "string") {
        continue;
      }

      flushUserParts();
      pendingModelParts.push({
        type: "tool_call",
        name: data.name,
        args: data.args ?? {},
      });
      continue;
    }

    if (event.kind === "tool_result") {
      const data = parseJsonSafely(event.text) as { name?: string; result?: unknown };
      if (!data || typeof data !== "object" || typeof data.name !== "string") {
        continue;
      }

      flushModelParts();
      pendingUserParts.push({
        type: "tool_result",
        name: data.name,
        result: data.result,
      });
      continue;
    }

    if (event.kind === "run_error") {
      flushUserParts();
      pendingModelParts.push({ type: "text", text: `Previous error: ${event.text}` });
      flushModelParts();
    }
  }

  flushModelParts();
  flushUserParts();

  return messages;
}

/**
 * Produces a safe replay window for the model.
 * Truncation happens by recent user turns rather than raw event count.
 */
export function buildRecentThreadMessages(
  events: ThreadEventDoc[],
  currentRunId: Id<"runs">,
  maxUserTurns = 8,
): ModelMessage[] {
  return trimToRecentUserTurns(buildThreadMessages(events, currentRunId), maxUserTurns);
}

function formatPart(part: ModelMessage["parts"][number]): string {
  if (part.type === "text") {
    return part.text;
  }

  if (part.type === "tool_call") {
    return `[tool_call] ${part.name}\n${JSON.stringify(part.args, null, 2)}`;
  }

  return `[tool_result] ${part.name}\n${JSON.stringify(part.result, null, 2)}`;
}

/**
 * Renders model messages into a readable thread transcript for trace files.
 */
export function formatThreadMessages(messages: ModelMessage[]): string {
  return messages
    .map((message, index) => {
      const label = message.role === "user" ? "USER" : "MODEL";
      const parts = message.parts.map(formatPart).join("\n\n");
      return `${index + 1}. ${label}\n${parts}`;
    })
    .join("\n\n");
}
