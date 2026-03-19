#!/usr/bin/env tsx
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { execSync } from "node:child_process";
import { config } from "dotenv";
import {
  createAgentSession,
  createBashTool,
  createExtensionRuntime,
  SessionManager,
  type ResourceLoader,
} from "./pi-mono/packages/coding-agent/src/index.ts";
import { Thread } from "./runtime/src/thread.ts";

config({ path: new URL(".env.local", import.meta.url).pathname });

type NextStep =
  | { intent: "request_more_information"; message: string }
  | { intent: "done_for_now"; message: string };

const CONTRACT = `You are a workflow agent with a bash tool.

The full conversation history is in XML tags above. A tree of available workflows has already been pre-loaded — look for it in the <executable_result> tags above.

Rules:
- Pick a workflow tool from the tree that matches the request
- Read its README if needed: cat workflows/<name>/tools/<tool>/README.md
- Run it by piping JSON: printf '<json>' | workflows/<name>/tools/<tool>/run
- NEVER compute results mentally — base your answer entirely on tool output

Output ONLY one of these when done (no markdown, no surrounding text):
{"intent":"request_more_information","message":"<question>"}
{"intent":"done_for_now","message":"<answer from tool output>"}`;

const DEBUG_THREAD = process.env.DEBUG_THREAD === "1";
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

function parseNextStep(raw: string): NextStep {
  const normalized = raw.trim();
  const fencedMatch = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fencedMatch?.[1]?.trim() ?? normalized;
  const objectMatch = jsonText.match(/\{[\s\S]*\}/);
  const candidate = objectMatch?.[0] ?? jsonText;
  const parsed = JSON.parse(candidate) as Partial<NextStep>;
  if (parsed.intent !== "request_more_information" && parsed.intent !== "done_for_now") {
    throw new Error(`Invalid intent in model response: ${raw}`);
  }
  if (typeof parsed.message !== "string" || parsed.message.trim().length === 0) {
    throw new Error(`Invalid message in model response: ${raw}`);
  }
  return { intent: parsed.intent, message: parsed.message } as NextStep;
}

// Commands matching these patterns require human approval before running
const DESTRUCTIVE_PATTERNS = [
  /workflows\/.*\/tools\/docs\.write\/run/,
  /workflows\/.*\/tools\/drive\.copy\/run/,
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

const readmeCommand = "find workflows -name README.md | sort | xargs -I{} sh -c 'echo \"=== {} ===\"; cat \"{}\"; echo'";
const readmeResult = (() => {
  try {
    return execSync(readmeCommand, { cwd: process.cwd(), encoding: "utf8" });
  } catch {
    return "";
  }
})();

const thread = new Thread({
  state: null,
  events: [
    { type: "system_note", data: CONTRACT },
    { type: "executable_call", data: { executableName: "bash", args: discoveryCommand } },
    { type: "executable_result", data: { executableName: "bash", result: discoveryResult } },
    { type: "executable_call", data: { executableName: "bash", args: readmeCommand } },
    { type: "executable_result", data: { executableName: "bash", result: readmeResult } },
    { type: "user_message", data: message },
  ],
});

let completed = false;

for (let turn = 0; turn < MAX_TURNS; turn += 1) {
  const serialized = thread.serializeForLLM();

  if (DEBUG_THREAD) {
    console.error("\n[thread.serializeForLLM()]");
    console.error(serialized);
    console.error();
  }

  const { session, modelFallbackMessage } = await createAgentSession({
    resourceLoader,
    tools: [withApprovalGate(createBashTool(process.cwd()), askHuman)],
    sessionManager: SessionManager.inMemory(),
  });

  if (modelFallbackMessage && turn === 0) {
    console.error(modelFallbackMessage);
  }

  let responseText = "";
  let bashCallCount = 0;

  const unsubscribe = session.subscribe((event) => {
    if (event.type === "tool_execution_start" && event.toolName === "bash") {
      bashCallCount += 1;
      const command = typeof event.args === "object" && event.args !== null && "command" in event.args
        ? String((event.args as { command: unknown }).command)
        : String(event.args);
      thread.append({ type: "executable_call", data: { executableName: "bash", args: command } });
    }

    if (event.type === "tool_execution_end" && event.toolName === "bash") {
      thread.append({
        type: "executable_result",
        data: { executableName: "bash", result: extractResultText(event.result) },
      });
    }

    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      responseText += event.assistantMessageEvent.delta;
    }
  });

  try {
    await session.prompt(serialized);
  } finally {
    unsubscribe();
    session.dispose();
  }

  if (DEBUG_THREAD) {
    console.error("\n[rawModelResponse]");
    console.error(responseText.trim());
    console.error();
  }

  const trimmed = responseText.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const reasoning = jsonMatch ? trimmed.slice(0, trimmed.indexOf(jsonMatch[0])).trim() : "";
  if (reasoning) thread.append({ type: "assistant_message", data: reasoning });
  thread.append({ type: "model_response", data: jsonMatch?.[0] ?? trimmed });

  let nextStep: NextStep;
  try {
    nextStep = parseNextStep(trimmed);
  } catch {
    thread.append({
      type: "system_note",
      data: `Your last response was not valid JSON. You must respond with exactly one of these shapes:\n{"intent":"request_more_information","message":"<question for the user>"}\n{"intent":"done_for_now","message":"<final answer>"}`,
    });
    continue;
  }

  if (nextStep.intent === "done_for_now") {
    const hasHumanTurn = thread.events.some((e) => e.type === "human_response");
    if (bashCallCount === 0 && hasHumanTurn) {
      thread.append({
        type: "system_note",
        data: "You answered without running any tools. You MUST run at least one workflow tool before responding with done_for_now. Use bash to call the appropriate tool and base your answer on its output.",
      });
      continue;
    }
    console.log(nextStep.message);
    completed = true;
    break;
  }

  if (nextStep.intent === "request_more_information") {
    const humanAnswer = await askHuman(nextStep.message);
    thread.append({ type: "human_response", data: humanAnswer });
    continue;
  }
}

if (!completed) {
  throw new Error(`Exceeded ${MAX_TURNS} turns without reaching done_for_now`);
}
