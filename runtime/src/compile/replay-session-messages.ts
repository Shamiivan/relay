import type { Id } from "../../../convex/_generated/dataModel";
import type { ModelMessage } from "../../../packages/model/src";
import type { SessionMessageDoc } from "../primitives/session";

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
 * Projects durable session messages into model-facing turns.
 */
export function buildSessionMessages(
  events: SessionMessageDoc[],
  _currentRunId: Id<"runs">,
): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (const event of events) {
    if (event.kind === "user_message") {
      messages.push({
        role: "user",
        parts: [{ type: "text", text: event.text }],
      });
      continue;
    }

    if (event.kind === "assistant_message") {
      messages.push({
        role: "model",
        parts: [{ type: "text", text: event.text }],
      });
    }
  }

  return messages;
}

/**
 * Produces a safe replay window for the model from recent session turns.
 */
export function buildRecentSessionMessages(
  events: SessionMessageDoc[],
  currentRunId: Id<"runs">,
  maxUserTurns = 8,
): ModelMessage[] {
  return trimToRecentUserTurns(buildSessionMessages(events, currentRunId), maxUserTurns);
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
 * Renders compiled model messages into a readable transcript for tracing.
 */
export function formatCompiledMessages(messages: ModelMessage[]): string {
  return messages
    .map((message, index) => {
      const label = message.role === "user" ? "USER" : "MODEL";
      const parts = message.parts.map(formatPart).join("\n\n");
      return `${index + 1}. ${label}\n${parts}`;
    })
    .join("\n\n");
}
