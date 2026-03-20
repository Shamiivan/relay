#!/usr/bin/env tsx
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { Type } from "@sinclair/typebox";
import {
  createAgentSession,
  createBashTool,
  createExtensionRuntime,
  SessionManager,
  type ResourceLoader,
  type ToolDefinition,
} from "./pi-mono/packages/coding-agent/src/index.ts";
import { Thread } from "./runtime/src/thread.ts";
import type { ThreadEvent } from "./runtime/src/thread.ts";

config({ path: new URL(".env.local", import.meta.url).pathname });

const CONTRACT = `You are a workflow agent. Your ONLY output mechanism is tool calls — never respond with plain text.

Tools:
- bash: discover and run workflow tools under workflows/
- ask_human: ask the user for clarification when their request is ambiguous
- done_for_now: deliver your final answer — ALWAYS call this to complete the task

Rules:
- NEVER respond with plain text. Every turn MUST end with a tool call.
- To answer the user: run a workflow tool via bash, then call done_for_now with the result.
- If tool results are already in the conversation, call done_for_now immediately.
- done_for_now is the ONLY way to complete the task.

Run tools with: printf '<json>' | workflows/<name>/tools/<tool>/run`;

const DEBUG_THREAD = process.env.DEBUG_THREAD === "1";

function formatEventShort(event: ThreadEvent): string {
  switch (event.type) {
    case "user_message": return `[user] ${event.data}`;
    case "assistant_message": return `[assistant] ${event.data}`;
    case "model_response": return `[done] ${event.data.slice(0, 120)}${event.data.length > 120 ? "…" : ""}`;
    case "system_note": return `[note] ${event.data.slice(0, 120)}${event.data.length > 120 ? "…" : ""}`;
    case "human_response": return `[human] ${event.data}`;
    case "request_human_clarification": return `[ask] ${event.data.prompt}`;
    case "executable_call": return `[bash] ${String(event.data.args).slice(0, 120)}`;
    case "executable_result": {
      const r = String(event.data.result);
      return `[result] ${r.slice(0, 200)}${r.length > 200 ? "…" : ""}`;
    }
    default: return `[${event.type}]`;
  }
}
const MAX_TURNS = 20;

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

async function askHuman(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(`${question}\n> `)).trim();
  } finally {
    rl.close();
  }
}

function createAskHumanTool(thread: Thread, ask: (q: string) => Promise<string>): ToolDefinition {
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
      const answer = await ask(params.question);
      thread.append({ type: "human_response", data: answer });
      return { content: [{ type: "text", text: answer }] };
    },
  };
}

function createDoneForNowTool(
  thread: Thread,
  onDone: (message: string) => void,
  abort: () => void,
  getWorkflowToolCalled: () => boolean,
): ToolDefinition {
  let called = false;
  return {
    name: "done_for_now",
    label: "Done",
    description:
      "Call this with the final answer when the task is complete. " +
      "Only call after running at least one workflow tool (workflows/.../run) via bash. " +
      "Do not call from memory or after only running discovery commands.",
    parameters: Type.Object({
      message: Type.String({ description: "The final answer to return to the user" }),
    }),
    execute: async (_toolCallId: string, params: { message: string }) => {
      if (!getWorkflowToolCalled()) {
        const msg = "ERROR: You must run a workflow tool (workflows/.../tools/.../run) via bash before calling done_for_now. Run the appropriate tool first.";
        thread.append({ type: "system_note", data: msg });
        return { content: [{ type: "text", text: msg }] };
      }
      if (called) return { content: [{ type: "text", text: "Already done." }] };
      called = true;
      thread.append({ type: "model_response", data: params.message });
      onDone(params.message);
      abort();
      return { content: [{ type: "text", text: "Answer delivered." }] };
    },
  };
}

// Commands matching these patterns require human approval before running
const DESTRUCTIVE_PATTERNS = [
  /workflows\/.*\/tools\/docs\.write\/run/,
  /workflows\/.*\/tools\/drive\.copy\/run/,
  /workflows\/.*\/tools\/apollo\.contact\.bulkCreate\/run/,
  /workflows\/.*\/tools\/apollo\.contact\.bulkUpdate\/run/,
  /workflows\/.*\/tools\/apollo\.account\.bulkCreate\/run/,
  /workflows\/.*\/tools\/apollo\.field\.create\/run/,
];

function withApprovalGate(
  tool: ReturnType<typeof createBashTool>,
  ask: (q: string) => Promise<string>,
): ReturnType<typeof createBashTool> {
  const originalExecute = tool.execute;
  return {
    ...tool,
    execute: async (args: unknown, context: unknown) => {
      const command =
        typeof args === "object" && args !== null && "command" in args
          ? String((args as { command: unknown }).command)
          : "";
      if (DESTRUCTIVE_PATTERNS.some((p) => p.test(command))) {
        const answer = await ask(`⚠️  Destructive operation — approve?\n\n  ${command}\n\n(yes/no)`);
        if (!answer.toLowerCase().startsWith("y")) {
          thread.append({ type: "system_note", data: "User declined the destructive operation. Do not retry it." });
          return { content: [{ type: "text", text: "Operation cancelled by user." }] };
        }
        thread.append({ type: "system_note", data: "User approved the destructive operation." });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalExecute(args as any, context as any);
    },
  };
}

function extractResultText(result: unknown): string {
  if (typeof result === "string") return result;
  // { content: [{ type: "text", text: "..." }] } — standard content block shape
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

const message = process.argv.slice(2).join(" ").trim();

if (!message) {
  console.error("Usage: relay <message>");
  process.exit(1);
}

const resourceLoader = createMinimalResourceLoader();

const discoveryCommand = "tree workflows";
const discoveryResult = (() => {
  try {
    return execSync(discoveryCommand, { cwd: process.cwd(), encoding: "utf8" });
  } catch {
    return execSync("find workflows -name run | sort", { cwd: process.cwd(), encoding: "utf8" });
  }
})();

const thread = new Thread({
  state: null,
  events: [
    { type: "system_note", data: CONTRACT },
    { type: "executable_call", data: { executableName: "bash", args: discoveryCommand } },
    { type: "executable_result", data: { executableName: "bash", result: discoveryResult } },
    { type: "user_message", data: message },
  ],
});

// Patch append to log every event as it lands
const _append = thread.append.bind(thread);
thread.append = (event: ThreadEvent) => {
  _append(event);
  if (DEBUG_THREAD) {
    console.error(thread.serializeForLLM());
  } else {
    console.error(formatEventShort(event));
  }
};

let completed = false;
let workflowToolCalled = false;

const runTs = new Date().toISOString().replace(/[:.]/g, "-");
const slug = message.slice(0, 50).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "run";
const runDir = `.runs/${runTs}-${slug}`;
mkdirSync(runDir, { recursive: true });

for (let turn = 0; turn < MAX_TURNS; turn += 1) {
  let doneMessage: string | null = null;

  const { session, modelFallbackMessage } = await createAgentSession({
    resourceLoader,
    tools: [withApprovalGate(createBashTool(process.cwd()), askHuman)],
    customTools: [
      createAskHumanTool(thread, askHuman),
      createDoneForNowTool(
        thread,
        (msg) => { doneMessage = msg; },
        () => { session.abort(); },
        () => workflowToolCalled,
      ),
    ],
    sessionManager: SessionManager.inMemory(),
  });

  if (modelFallbackMessage && turn === 0) {
    console.error(modelFallbackMessage);
  }

  const unsubscribe = session.subscribe((event) => {
    if (event.type === "tool_execution_start" && event.toolName === "bash") {
      const command = typeof event.args === "object" && event.args !== null && "command" in event.args
        ? String((event.args as { command: unknown }).command)
        : String(event.args);
      if (/workflows\/.*\/tools\/.*\/run/.test(command)) {
        workflowToolCalled = true;
      }
      thread.append({ type: "executable_call", data: { executableName: "bash", args: command } });
    }

    if (event.type === "tool_execution_end" && event.toolName === "bash") {
      const result = extractResultText(event.result);
      thread.append({
        type: "executable_result",
        data: { executableName: "bash", result: result },
      });
    }
  });

  try {
    await session.prompt(thread.serializeForLLM());
  } finally {
    unsubscribe();
    session.dispose();
  }

  writeFileSync(`${runDir}/turn-${turn}.txt`, thread.serializeForLLM(), "utf8");

  if (doneMessage !== null) {
    console.log(doneMessage);
    completed = true;
    break;
  }
}

if (!completed) {
  throw new Error(`Exceeded ${MAX_TURNS} turns without reaching done_for_now`);
}
