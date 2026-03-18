import type { RunDoc } from "./run";
import type { SessionDoc } from "./session";
import type { ContextSection } from "../context/sections.ts";
import type { IntentDeclaration } from "../execution/determine-next-step/contract.ts";

/**
 * Thread events represent the in-memory context of an active session, optimized for LLM reasoning.
 *
 * Unlike the durable database records, thread events are a reasoning-friendly
 * projection. Human tool calls can be projected into explicit clarification or
 * approval events so the loop and the model see the interaction clearly.
 */
export type ThreadData =
  | string
  | number
  | boolean
  | null
  | ThreadData[]
  | { [key: string]: ThreadData };

export type ThreadEvent =
  | { type: "user_message"; data: string }
  | { type: "assistant_message"; data: string }
  | { type: "model_response"; data: string }
  | { type: "request_human_clarification"; data: { prompt: string } }
  | { type: "request_human_approval"; data: { prompt: string } }
  | { type: "human_response"; data: string }
  | { type: "executable_call"; data: { executableName: string; args: ThreadData } }
  | { type: "executable_result"; data: { executableName: string; result: ThreadData } }
  | { type: "workflow_state"; data: ThreadData }
  | { type: "system_note"; data: string };

/**
 * Thread is the in-memory context object used by the runtime loop.
 * It is reconstructed from durable state and extended during execution.
 */
export class Thread<TState = ThreadData> {
  readonly session: SessionDoc | null;
  readonly run: RunDoc | null;
  readonly state: TState;
  readonly events: ThreadEvent[];
  determineNextStepSections: ContextSection[];
  determineNextStepContract: readonly IntentDeclaration[];

  constructor(args: {
    session?: SessionDoc | null;
    run?: RunDoc | null;
    state: TState;
    events: ThreadEvent[];
    determineNextStepSections?: ContextSection[];
    determineNextStepContract?: readonly IntentDeclaration[];
  }) {
    this.session = args.session ?? null;
    this.run = args.run ?? null;
    this.state = args.state;
    this.events = args.events;
    this.determineNextStepSections = [...(args.determineNextStepSections ?? [])];
    this.determineNextStepContract = args.determineNextStepContract ?? [];
  }

  append(event: ThreadEvent): void {
    this.events.push(event);
  }

  serializeForLLM(): string {
    return this.events.map((event) => this.serializeEvent(event)).join("\n\n");
  }

  private serializeEvent(event: ThreadEvent): string {
    if (
      typeof event.data === "string"
      || typeof event.data === "number"
      || typeof event.data === "boolean"
      || event.data === null
    ) {
      return `<${event.type}>\n${String(event.data)}\n</${event.type}>`;
    }

    return [
      `<${event.type}>`,
      ...Object.entries(event.data).map(([key, value]) => `${key}: ${this.renderValue(value)}`),
      `</${event.type}>`,
    ].join("\n");
  }

  private renderValue(value: ThreadData): string {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
}
