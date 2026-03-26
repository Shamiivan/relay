#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import { checkpointContext, updateStatus } from "./context-store.ts";
import {
  createAgentSession,
  createBashTool,
  createExtensionRuntime,
  SessionManager,
  type ResourceLoader,
  type ToolDefinition,
} from "../../pi-mono/packages/coding-agent/src/index.ts";
import { Thread } from "./thread.ts";
import type { SessionMeta } from "./context-store.ts";
import type { ThreadEvent } from "./thread.ts";
import type { TransportAdapter } from "./transport.ts";

const CONTRACT = `You are a the company chief of staff assistant to the CEO.
Working in avantech.
Your ONLY output mechanism is tool calls — never respond with plain text.

Tools:
- bash: discover and run workflow tools under workflows/ and company/workflows/
- ask_human: ask the user for clarification when their request is ambiguous
- done_for_now: deliver your final answer — ALWAYS call this to complete the task

Rules:
- NEVER respond with plain text. Every turn MUST end with a tool call.
- To answer the user: run a workflow tool via bash, then call done_for_now with the result.
- If tool results are already in the conversation, call done_for_now immediately.
- done_for_now is the ONLY way to complete the task.
- Read workflow guidance with: cat workflows/<name>/README.md or cat company/workflows/<name>/README.md
- Read tool guidance with: cat workflows/<name>/tools/<tool>/README.md or cat company/workflows/<name>/tools/<tool>/README.md
- When the correct tool or arguments are not obvious, read the relevant README before running the tool.

Run tools with: printf '<json>' | workflows/<name>/tools/<tool>/run or printf '<json>' | company/workflows/<name>/tools/<tool>/run`;

const DEBUG_THREAD = process.env.DEBUG_THREAD === "1";
const WORKFLOW_RUN_PATTERN = /(?:^|[^/])(workflows|company\/workflows)\/.*\/tools\/.*\/run/;

// Commands matching these patterns require human approval before running
const DESTRUCTIVE_PATTERNS = [
  /(?:workflows|company\/workflows)\/.*\/tools\/docs\.write\/run/,
  /(?:workflows|company\/workflows)\/.*\/tools\/drive\.copy\/run/,
  /(?:workflows|company\/workflows)\/.*\/tools\/apollo\.contact\.bulkCreate\/run/,
  /(?:workflows|company\/workflows)\/.*\/tools\/apollo\.contact\.bulkUpdate\/run/,
  /(?:workflows|company\/workflows)\/.*\/tools\/apollo\.account\.bulkCreate\/run/,
  /(?:workflows|company\/workflows)\/.*\/tools\/apollo\.field\.create\/run/,
];

const MAX_TURNS = 50;

function createMinimalResourceLoader(): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => CONTRACT,
    getAppendSystemPrompt: () => [],
    getPathMetadata: () => new Map(),
    extendResources: () => { },
    reload: async () => { },
  };
}

function extractResultText(result: unknown): string {
  if (typeof result === "string") return result;
  if (typeof result === "object" && result !== null && "content" in result && Array.isArray((result as { content: unknown }).content)) {
    return ((result as { content: unknown[] }).content)
      .filter((item): item is { type: string; text: string } => typeof item === "object" && item !== null && "text" in item)
      .map((item) => item.text)
      .join("");
  }
  if (Array.isArray(result)) {
    return result
      .map((item) =>
        typeof item === "object" && item !== null && "text" in item
          ? String((item as { text: unknown }).text)
          : JSON.stringify(item)
      )
      .join("");
  }
  return JSON.stringify(result, null, 2);
}

function createAskHumanTool(
  thread: Thread,
  transport: TransportAdapter,
  /** Called before blocking for human input. Returns the session ID written to disk. */
  onBeforePause: (question: string) => string,
): ToolDefinition {
  return {
    name: "ask_human",
    label: "Ask Human",
    description:
      "Ask the user a clarifying question when the request is ambiguous. " +
      "The user's answer will be returned as the tool result. " +
      "Do NOT use this to get permission to run tools.",
    parameters: Type.Object({
      question: Type.String({ description: "The question to ask the user" }),
    }),
    execute: async (_toolCallId: string, params: { question: string }) => {
      thread.append({ type: "request_human_clarification", data: { prompt: params.question } });
      onBeforePause(params.question);
      const answer = await transport.promptForClarification(params.question);
      thread.append({ type: "human_response", data: answer });
      return { content: [{ type: "text", text: answer }], details: null };
    },
  };
}

function createDoneForNowTool(
  thread: Thread,
  onDone: (message: string) => void,
  abort: () => void,
  getWorkflowToolCalled: () => boolean,
  /** Called when the task completes successfully — used to mark the session done. */
  onComplete?: () => void,
): ToolDefinition {
  let called = false;
  return {
    name: "done_for_now",
    label: "Done",
    description:
      "Call this with the final answer when the task is complete. " +
      "Only call after running at least one workflow tool " +
      "((workflows/.../run) or (company/workflows/.../run)) via bash. " +
      "Do not call from memory or after only running discovery commands.",
    parameters: Type.Object({
      message: Type.String({ description: "The final answer to return to the user" }),
    }),
    execute: async (_toolCallId: string, params: { message: string }) => {
      if (!getWorkflowToolCalled()) {
        const msg =
          "ERROR: You must run a workflow tool " +
          "((workflows/.../tools/.../run) or (company/workflows/.../tools/.../run)) via bash " +
          "before calling done_for_now. Run the appropriate tool first.";
        thread.append({ type: "system_note", data: msg });
        return { content: [{ type: "text", text: msg }], details: null };
      }
      if (called) return { content: [{ type: "text", text: "Already done." }], details: null };
      called = true;
      thread.append({ type: "model_response", data: params.message });
      onDone(params.message);
      onComplete?.();
      abort();
      return { content: [{ type: "text", text: "Answer delivered." }], details: null };
    },
  };
}

/** Wraps the bash tool to intercept destructive commands and route approval through the transport. */
function createApprovalGateBashTool(
  cwd: string,
  thread: Thread,
  transport: TransportAdapter,
): ReturnType<typeof createBashTool> {
  const tool = createBashTool(cwd);
  const originalExecute = tool.execute;
  return {
    ...tool,
    execute: async (args: unknown, context: unknown) => {
      const command =
        typeof args === "object" && args !== null && "command" in args
          ? String((args as { command: unknown }).command)
          : "";
      if (DESTRUCTIVE_PATTERNS.some((p) => p.test(command))) {
        let verdict: "approved" | "denied";
        try {
          verdict = await transport.promptForApproval(
            `⚠️  Destructive operation — approve?\n\n  ${command}`,
          );
        } catch {
          // Timeout or transport error — treat as denied
          verdict = "denied";
        }
        if (verdict !== "approved") {
          thread.append({ type: "system_note", data: "User declined the destructive operation. Do not retry it." });
          return { content: [{ type: "text", text: "Operation cancelled by user." }], details: null };
        }
        thread.append({ type: "system_note", data: "User approved the destructive operation." });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalExecute(args as any, context as any);
    },
  };
}

/**
 * Runs the relay agent loop for a single message.
 *
 * All human-facing interactions are routed through the transport so the same
 * loop can be driven by CLI, Discord, or any other surface.
 */
export async function runRelay(
  message: string,
  transport: TransportAdapter,
  options: {
    cwd?: string;
    maxTurns?: number;
    /** Set when resuming a paused session. */
    resumedSession?: {
      id: string;
      events: ThreadEvent[];
      meta: SessionMeta;
      humanResponse: string;
    };
  } = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const maxTurns = options.maxTurns ?? MAX_TURNS;
  const resourceLoader = createMinimalResourceLoader();

  // Session state — runner owns all of this, tools close over it
  const contextDir = join(cwd, ".contexts");
  const scope = message.slice(0, 50).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
  // On resume, seed the ID immediately so done_for_now marks it correctly
  let activeSessionId: string | null = options.resumedSession?.id ?? null;
  let lastWorkflowName = options.resumedSession?.meta.workflow ?? "unknown";

  // const discoveryCommand = "find workflows company/ -maxdepth 3 \\( -type d -o -type f \\) | sort";
  const discoveryCommand = "tree company/workflows/"
  const discoveryResult = (() => {
    try {
      return execSync(discoveryCommand, { cwd, encoding: "utf8" });
    } catch {
      return execSync("find workflows company/ -name run | sort", { cwd, encoding: "utf8" });
    }
  })();

  const { resumedSession } = options;
  const thread = new Thread({
    state: null,
    events: resumedSession
      // Resume: rehydrate prior events directly and append the human's response
      ? [
          ...resumedSession.events,
          { type: "human_response", data: resumedSession.humanResponse },
        ]
      // Fresh start: CONTRACT + discovery + user message
      : [
          { type: "system_note", data: CONTRACT },
          { type: "executable_call", data: { executableName: "bash", args: discoveryCommand } },
          { type: "executable_result", data: { executableName: "bash", result: discoveryResult } },
          { type: "user_message", data: message },
        ],
  });

  // Patch append to emit every event through the transport
  const _append = thread.append.bind(thread);
  thread.append = (event: ThreadEvent) => {
    _append(event);
    if (DEBUG_THREAD) {
      console.error(thread.serializeForLLM());
    }
    // Fire-and-forget — transport decides whether to display
    transport.publishEvent(event).catch(() => { });
  };

  const runTs = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = message.slice(0, 50).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "run";
  const runDir = `.runs/${runTs}-${slug}`;
  mkdirSync(runDir, { recursive: true });

  let completed = false;
  let workflowToolCalled = false;

  for (let turn = 0; turn < maxTurns; turn += 1) {
    let doneMessage: string | null = null;
    const writeTurnSnapshot = () => {
      writeFileSync(`${runDir}/turn-${turn}.txt`, thread.serializeForLLM(), "utf8");
    };

    const { session, modelFallbackMessage } = await createAgentSession({
      resourceLoader,
      tools: [createApprovalGateBashTool(cwd, thread, transport)],
      customTools: [
        createAskHumanTool(thread, transport, (question) => {
          activeSessionId = checkpointContext(
            contextDir,
            {
              workflow: lastWorkflowName,
              scope,
              status: "paused",
              phase: "unknown",
              pending: question,
              approved: [],
              rejected: [],
              createdAt: new Date().toISOString(),
              forkedFrom: null,
            },
            JSON.stringify(thread.events),
            thread.serializeForLLM(),
          );
          return activeSessionId;
        }),
        createDoneForNowTool(
          thread,
          (msg) => { doneMessage = msg; },
          () => { session.abort(); },
          () => workflowToolCalled,
          () => {
            if (activeSessionId) {
              updateStatus(contextDir, activeSessionId, "done");
            }
          },
        ),
      ],
      sessionManager: SessionManager.inMemory(),
    });

    if (modelFallbackMessage && turn === 0) {
      await transport.publishEvent({ type: "system_note", data: modelFallbackMessage });
    }

    const unsubscribe = session.subscribe((event) => {
      console.log("==================================================================================================")
      console.log("Event:", event);
      console.log("==================================================================================================")
      if (event.type === "tool_execution_start" && event.toolName === "bash") {
        const command = typeof event.args === "object" && event.args !== null && "command" in event.args
          ? String((event.args as { command: unknown }).command)
          : String(event.args);
        if (WORKFLOW_RUN_PATTERN.test(command)) {
          workflowToolCalled = true;
          const wfMatch = command.match(/(?:workflows|company\/workflows)\/([^/]+)\/tools/);
          if (wfMatch) lastWorkflowName = wfMatch[1];
        }
        thread.append({ type: "executable_call", data: { executableName: "bash", args: command } });
      }

      if (event.type === "tool_execution_end" && event.toolName === "bash") {
        const result = extractResultText(event.result);
        thread.append({
          type: "executable_result",
          data: { executableName: "bash", result },
        });
      }
    });

    try {
      await session.prompt(thread.serializeForLLM());
    } finally {
      writeTurnSnapshot();
      unsubscribe();
      session.dispose();
    }

    if (doneMessage !== null) {
      await transport.publishFinal(doneMessage);
      completed = true;
      break;
    }
  }

  if (!completed) {
    throw new Error(`Exceeded ${maxTurns} turns without reaching done_for_now`);
  }
}
