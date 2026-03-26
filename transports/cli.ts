import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { ThreadEvent } from "../runtime/src/thread.ts";
import type { TransportAdapter } from "../runtime/src/transport.ts";

/**
 * Formats a ThreadEvent as a short human-readable line for terminal output.
 * Moved here from cli.ts — only the CLI needs this presentation format.
 */
export function formatEventShort(event: ThreadEvent): string {
  switch (event.type) {
    case "user_message": return `[user] ${event.data}`;
    case "assistant_message": return `[assistant] ${event.data}`;
    case "model_response": return `[done] ${event.data.slice(0, 120)}${event.data.length > 120 ? "…" : ""}`;
    case "system_note": return `[note] ${event.data.slice(0, 120)}${event.data.length > 120 ? "…" : ""}`;
    case "human_response": return `[human] ${event.data}`;
    case "request_human_clarification": return `[ask] ${event.data.prompt}`;
    case "request_human_approval": return `[approval] ${event.data.prompt}`;
    case "executable_call": return `[bash] ${String(event.data.args).slice(0, 120)}`;
    case "executable_result": {
      const r = String(event.data.result);
      return `[result] ${r.slice(0, 200)}${r.length > 200 ? "…" : ""}`;
    }
    default: return `[${(event as ThreadEvent).type}]`;
  }
}

/**
 * CLI transport — reads clarification/approval via readline, prints events to stderr,
 * and prints the final answer to stdout. Preserves the pre-extraction UX exactly.
 */
export function createCliTransport(): TransportAdapter {
  async function ask(question: string): Promise<string> {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      return (await rl.question(`${question}\n> `)).trim();
    } finally {
      rl.close();
    }
  }

  return {
    async promptForClarification(prompt: string): Promise<string> {
      return ask(prompt);
    },

    async promptForApproval(prompt: string): Promise<"approved" | "denied"> {
      const answer = await ask(prompt + "\n\n(yes/no)");
      return answer.toLowerCase().startsWith("y") ? "approved" : "denied";
    },

    async publishEvent(event: ThreadEvent): Promise<void> {
      console.error(formatEventShort(event));
    },

    async publishFinal(message: string): Promise<void> {
      console.log(message);
    },
  };
}
