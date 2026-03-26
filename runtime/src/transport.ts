import type { ThreadEvent } from "./thread.ts";

/**
 * TransportAdapter is the narrow boundary between the agent runner and
 * whatever surface the human is using (CLI, Discord, etc.).
 *
 * All human-facing interactions go through this interface.
 * The runner never imports readline, discord.js, or any I/O directly.
 */
export type TransportAdapter = {
  /**
   * Ask the human a clarifying question and wait for their response.
   * Throws on timeout so the runner can append a system_note and abort cleanly.
   */
  promptForClarification(prompt: string): Promise<string>;

  /**
   * Ask the human to approve or deny a destructive operation.
   * Throws on timeout so the runner can abort cleanly.
   */
  promptForApproval(prompt: string): Promise<"approved" | "denied">;

  /**
   * Non-blocking progress update. Transports decide whether and how to render it.
   * Uses ThreadEvent directly — no duplicate type.
   */
  publishEvent(event: ThreadEvent): Promise<void>;

  /**
   * Deliver the final answer to the human. Called exactly once per run.
   * Transports should clear any typing indicators here.
   */
  publishFinal(message: string): Promise<void>;
};
