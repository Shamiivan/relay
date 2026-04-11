#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import {
  checkpointContext,
  listContexts,
  reconcileInProgress,
  updateStatus,
} from "./context-store.ts";
import {
  createAgentSession,
  createBashTool,
  createExtensionRuntime,
  SessionManager,
  type ResourceLoader,
  type ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { Thread } from "./thread.ts";
import type { SessionMeta } from "./context-store.ts";
import { deriveSessionName } from "./session-naming.ts";
import type { ThreadEvent } from "./thread.ts";
import type { TransportAdapter } from "./transport.ts";

// Write current thread events to the session file — called on every append
function writeSessionEvents(
  contextDir: string,
  sessionId: string,
  events: ThreadEvent[],
): void {
  const path = join(contextDir, "in_progress", sessionId, "thread-events.json");
  try {
    writeFileSync(path, JSON.stringify(events), "utf8");
  } catch {
    // Best-effort — don't crash the agent if the write fails
  }
}

// Rewrite the run log with the full serialized thread (same format the LLM sees)
function writeRunLog(logPath: string, serialized: string): void {
  try {
    writeFileSync(logPath, serialized, "utf8");
  } catch {
    // Best-effort
  }
}

const CONTRACT = `You are the company chief of staff assistant to the CEO.
Working in avantech.
Your ONLY output mechanism is tool calls — never respond with plain text.

Tools:
- bash: discover and run workflow tools under company/workflows/
- ask_human: ask the user a question — this also saves your progress. When mid-workflow, pass summary, next_steps, and artifacts so context is preserved.
- done_for_now: deliver your final answer — the human will confirm if we are truly done

Rules:
- NEVER respond with plain text. Every turn MUST end with a tool call.
- Use bash when you need to discover or run workflow tools.
- If the answer is already clear from the conversation, call done_for_now directly.
- done_for_now is the ONLY way to complete the task.
- Read workflow guidance with: cat company/workflows/<name>/README.md
- Read tool guidance with: cat company/workflows/<name>/tools/<tool>/README.md when that path exists
- When the correct tool or arguments are not obvious, read the relevant README before running the tool.
- On startup: if a system_note lists prior paused sessions, review them before acting on the user message.

Run tools with: printf '<json>' | company/workflows/<name>/tools/<tool>
If the tool is a directory rather than an executable file, append /run. Prefer the direct executable path when both exist.`;

const DEBUG_THREAD = process.env.DEBUG_THREAD === "1";
const WORKFLOW_TOOL_PATTERN =
  /(?:^|[^/])(?:workflows|company\/workflows)\/([^/\s]+)\/tools\/([^/\s]+)(?:\/run)?(?=\s|$|["'])/;

// Commands matching these patterns require human approval before running
const DESTRUCTIVE_PATTERNS = [
  /(?:workflows|company\/workflows)\/[^/\s]+\/tools\/docs\.write(?:\/run)?(?=\s|$|["'])/,
  /(?:workflows|company\/workflows)\/[^/\s]+\/tools\/drive\.copy(?:\/run)?(?=\s|$|["'])/,
  /(?:workflows|company\/workflows)\/[^/\s]+\/tools\/apollo\.contact\.bulkCreate(?:\/run)?(?=\s|$|["'])/,
  /(?:workflows|company\/workflows)\/[^/\s]+\/tools\/apollo\.contact\.bulkUpdate(?:\/run)?(?=\s|$|["'])/,
  /(?:workflows|company\/workflows)\/[^/\s]+\/tools\/apollo\.account\.bulkCreate(?:\/run)?(?=\s|$|["'])/,
  /(?:workflows|company\/workflows)\/[^/\s]+\/tools\/apollo\.field\.create(?:\/run)?(?=\s|$|["'])/,
];

const MAX_TURNS = 50;

function createMinimalResourceLoader(): ResourceLoader {
  return {
    getExtensions: () => ({
      extensions: [],
      errors: [],
      runtime: createExtensionRuntime(),
    }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => CONTRACT,
    getAppendSystemPrompt: () => [],
    getPathMetadata: () => new Map(),
    extendResources: () => {},
    reload: async () => {},
  };
}

function extractResultText(result: unknown): string {
  const sanitize = (text: string): string =>
    text
      .replace(
        /\(node:\d+\) \[DEP0040\] DeprecationWarning: The `punycode` module is deprecated\. Please use a userland alternative instead\.\n(?:\(Use `node --trace-deprecation \.\.\.` to show where the warning was created\)\n)?/g,
        "",
      )
      .replace(/Both GOOGLE_API_KEY and GEMINI_API_KEY are set\. Using GOOGLE_API_KEY\.\n?/g, "")
      .trim();

  if (typeof result === "string") return sanitize(result);
  if (
    typeof result === "object" &&
    result !== null &&
    "content" in result &&
    Array.isArray((result as { content: unknown }).content)
  ) {
    return sanitize((result as { content: unknown[] }).content
      .filter(
        (item): item is { type: string; text: string } =>
          typeof item === "object" && item !== null && "text" in item,
      )
      .map((item) => item.text)
      .join(""));
  }
  if (Array.isArray(result)) {
    return sanitize(result
      .map((item) =>
        typeof item === "object" && item !== null && "text" in item
          ? String((item as { text: unknown }).text)
          : JSON.stringify(item),
      )
      .join(""));
  }
  return sanitize(JSON.stringify(result, null, 2));
}

/**
 * Create the ask_human tool.
 * Transitions the session to `paused` before blocking for human input,
 * storing rich handoff context so the session can be recovered.
 */
function createAskHumanTool(
  thread: Thread,
  transport: TransportAdapter,
  contextDir: string,
  getActiveSessionId: () => string | null,
): ToolDefinition {
  return {
    name: "ask_human",
    label: "Ask Human",
    description:
      "Ask the user a clarifying question when the request is ambiguous. " +
      "The user's answer will be returned as the tool result. " +
      "Do NOT use this to get permission to run tools. " +
      "Pass summary, next_steps, and artifacts when mid-workflow so context is preserved.",
    parameters: Type.Object({
      question: Type.String({ description: "The question to ask the user" }),
      summary: Type.Optional(
        Type.String({ description: "Summary of work done so far" }),
      ),
      next_steps: Type.Optional(
        Type.Array(Type.String(), { description: "Planned next steps" }),
      ),
      artifacts: Type.Optional(
        Type.Array(
          Type.Object({
            ref: Type.String(),
            description: Type.String(),
          }),
          { description: "Relevant artifacts produced so far" },
        ),
      ),
      last_action: Type.Optional(
        Type.String({ description: "The last action taken" }),
      ),
    }),
    execute: async (
      _toolCallId: string,
      params: {
        question: string;
        summary?: string;
        next_steps?: string[];
        artifacts?: Array<{ ref: string; description: string }>;
        last_action?: string;
      },
    ) => {
      thread.append({
        type: "request_human_clarification",
        data: { prompt: params.question },
      });

      const sessionId = getActiveSessionId();
      if (sessionId) {
        updateStatus(contextDir, sessionId, "paused", {
          awaiting: params.question,
          summary: params.summary,
          next_steps: params.next_steps,
          artifacts: params.artifacts,
          last_action: params.last_action,
        });
      }

      const answer = await transport.promptForClarification(params.question);
      thread.append({ type: "human_response", data: answer });
      return { content: [{ type: "text", text: answer }], details: null };
    },
  };
}

/**
 * Create the done_for_now tool.
 * Transitions to paused with proposed_final, then asks the human to confirm.
 * If confirmed → marks done, ends run.
 * If rejected → appends system_note and continues the loop.
 */
function createDoneForNowTool(
  thread: Thread,
  transport: TransportAdapter,
  contextDir: string,
  getActiveSessionId: () => string | null,
  onDone: (message: string) => void,
  abort: () => void,
  onComplete: () => void,
): ToolDefinition {
  let called = false;
  return {
    name: "done_for_now",
    label: "Done",
    description: "Call this with the final answer when the task is complete.",
    parameters: Type.Object({
      message: Type.String({
        description: "The final answer to return to the user",
      }),
    }),
    execute: async (_toolCallId: string, params: { message: string }) => {
      if (called)
        return {
          content: [{ type: "text", text: "Already done." }],
          details: null,
        };
      called = true;

      // Transition to paused with proposed_final while we wait for confirmation
      const sessionId = getActiveSessionId();
      if (sessionId) {
        updateStatus(contextDir, sessionId, "paused", {
          awaiting: "completion_confirmation",
          proposed_final: params.message,
        });
      }

      thread.append({ type: "model_response", data: params.message });

      // Ask the human for confirmation
      const answer = await transport.promptForClarification(
        `${params.message}\n\nAre we done? (yes / no)`,
      );

      if (answer.trim().toLowerCase().startsWith("y")) {
        // Confirmed done
        if (sessionId) {
          updateStatus(contextDir, sessionId, "done");
        }
        onDone(params.message);
        onComplete();
        abort();
        return {
          content: [{ type: "text", text: "Answer delivered." }],
          details: null,
        };
      }

      // Not accepted — reset called so done_for_now can be called again
      called = false;
      const note = `Prior answer was not accepted by the user. Clarification: ${answer}`;
      thread.append({ type: "system_note", data: note });
      return { content: [{ type: "text", text: note }], details: null };
    },
  };
}

/** Wraps the bash tool to intercept destructive commands and route approval through the transport. */
function createApprovalGateBashTool(
  cwd: string,
  thread: Thread,
  transport: TransportAdapter,
): ReturnType<typeof createBashTool> {
  const tool = createBashTool(cwd, {
    spawnHook: (context) => ({
      ...context,
      env: {
        ...context.env,
        NODE_NO_WARNINGS: "1",
        DOTENV_CONFIG_QUIET: "true",
      },
    }),
  });
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
          thread.append({
            type: "system_note",
            data: "User declined the destructive operation. Do not retry it.",
          });
          return {
            content: [{ type: "text", text: "Operation cancelled by user." }],
            details: null,
          };
        }
        thread.append({
          type: "system_note",
          data: "User approved the destructive operation.",
        });
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

  // Step 1: Reconcile any in_progress sessions from a previous crashed run
  reconcileInProgress(contextDir);

  let lastWorkflowName = options.resumedSession?.meta.workflow ?? "unknown";

  // Step 2: Create this session as in_progress immediately (or reuse the resumed id)
  const now = new Date().toISOString();
  const { displayName, slug } = deriveSessionName(message);
  const sessionMeta: SessionMeta = options.resumedSession
    ? options.resumedSession.meta
    : {
        id: `${slug}__${lastWorkflowName}__${now.replace(/:/g, "-")}`,
        displayName,
        workflow: lastWorkflowName,
        createdAt: now,
        updatedAt: now,
        forkedFrom: null,
        initialUserMessage: message,
      };

  let activeSessionId: string =
    options.resumedSession?.id ??
    checkpointContext(contextDir, sessionMeta, "[]");

  /** Getter so tool closures always read the current value. */
  const getActiveSessionId = () => activeSessionId;

  const discoveryCommand = "tree company/workflows/";
  const discoveryResult = (() => {
    try {
      return execSync(discoveryCommand, { cwd, encoding: "utf8" });
    } catch {
      return execSync("find company/workflows -name run | sort", {
        cwd,
        encoding: "utf8",
      });
    }
  })();

  const { resumedSession } = options;

  // Step 3: Build initial thread events
  const initialEvents: ThreadEvent[] = resumedSession
    ? [
        ...resumedSession.events,
        { type: "human_response", data: resumedSession.humanResponse },
      ]
    : [
        { type: "system_note", data: CONTRACT },
        {
          type: "executable_call",
          data: { executableName: "bash", args: discoveryCommand },
        },
        {
          type: "executable_result",
          data: { executableName: "bash", result: discoveryResult },
        },
        { type: "user_message", data: message },
      ];

  // Step 4: Auto-inject paused sessions for the same workflow (fresh runs only)
  if (!resumedSession) {
    const pausedSessions = listContexts(contextDir, "paused").filter(
      (s) => s.meta.workflow === lastWorkflowName,
    );
    if (pausedSessions.length > 0) {
      const note =
        "Paused sessions for this workflow:\n" +
        pausedSessions
          .map(
            (s) =>
              `- ${s.id}: awaiting "${s.meta.handoff?.awaiting ?? "unknown"}"`,
          )
          .join("\n");
      initialEvents.push({ type: "system_note", data: note });
    }
  }

  const runTs = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(".runs", { recursive: true });
  const runLogPath = `.runs/${slug}__${runTs}.log`;

  const thread = new Thread({ state: null, events: initialEvents });

  // Patch append to emit every event through the transport and write continuously
  const _append = thread.append.bind(thread);
  thread.append = (event: ThreadEvent) => {
    _append(event);
    if (DEBUG_THREAD) {
      console.log(thread.serializeForLLM());
    }
    // Fire-and-forget — transport decides whether to display
    transport.publishEvent(event).catch(() => {});
    writeSessionEvents(contextDir, activeSessionId, thread.events);
    writeRunLog(runLogPath, thread.serializeForLLM());
  };

  let completed = false;
  for (let turn = 0; turn < maxTurns; turn += 1) {
    let doneMessage: string | null = null;

    const { session, modelFallbackMessage } = await createAgentSession({
      resourceLoader,
      tools: [createApprovalGateBashTool(cwd, thread, transport)],
      customTools: [
        createAskHumanTool(thread, transport, contextDir, getActiveSessionId),
        createDoneForNowTool(
          thread,
          transport,
          contextDir,
          getActiveSessionId,
          (msg) => {
            doneMessage = msg;
          },
          () => {
            session.abort();
          },
          () => {
            /* onComplete — session already marked done inside the tool */
          },
        ),
      ],
      sessionManager: SessionManager.inMemory(),
    });

    if (modelFallbackMessage && turn === 0) {
      await transport.publishEvent({
        type: "system_note",
        data: modelFallbackMessage,
      });
    }

    const unsubscribe = session.subscribe((event) => {
      if (DEBUG_THREAD) {
        console.log(
          "==================================================================================================",
        );
        console.log("Event:", event);
        console.log(
          "==================================================================================================",
        );
      }
      if (event.type === "tool_execution_start" && event.toolName === "bash") {
        const command =
          typeof event.args === "object" &&
          event.args !== null &&
          "command" in event.args
            ? String((event.args as { command: unknown }).command)
            : String(event.args);
        const wfMatch = command.match(WORKFLOW_TOOL_PATTERN);
        if (wfMatch) {
          lastWorkflowName = wfMatch[1]!;
          if (sessionMeta.workflow === "unknown") {
            sessionMeta.workflow = lastWorkflowName;
            // Patch meta.json immediately so disk is always current
            const metaPath = join(
              contextDir,
              "in_progress",
              activeSessionId,
              "meta.json",
            );
            try {
              writeFileSync(
                metaPath,
                JSON.stringify(
                  { ...sessionMeta, updatedAt: new Date().toISOString() },
                  null,
                  2,
                ),
                "utf8",
              );
            } catch {
              /* best-effort */
            }
          }
        }
        thread.append({
          type: "executable_call",
          data: { executableName: "bash", args: command },
        });
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
