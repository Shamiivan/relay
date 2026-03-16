import fs from "node:fs/promises";
import path from "node:path";
import type { ConvexClient } from "convex/browser";
import type { SpecialistConfig } from "../../../packages/contracts/src";
import { runOpenLoop, type RuntimeEnv } from "./open-loop";
import { createFinalizeStep, finalizeSuccessfulRun } from "./finalize-run";
import { runWorkflow } from "./workflow";
import type { RunDoc } from "../primitives/run";
import type { SessionDoc } from "../primitives/session";
import type { ToolManifest } from "../tools/tool-registry";
import { appendTraceEvent } from "../tracing/trace-file";

function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

async function loadPrompt(promptFile: string): Promise<string> {
  return await fs.readFile(repoPath(promptFile), "utf8");
}

async function loadContext(contextFiles: string[]): Promise<string> {
  const chunks = await Promise.all(
    contextFiles.map(async (file) => {
      const content = await fs.readFile(repoPath(file), "utf8");
      return `# ${file}\n${content.trim()}`;
    }),
  );

  return chunks.join("\n\n").trim();
}

function buildSystemInstruction(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Dispatches one run to the execution mode declared on the durable run record.
 */
export async function runLoop(params: {
  convex: ConvexClient;
  run: RunDoc;
  session: SessionDoc;
  specialist: SpecialistConfig;
  allowedTools: ToolManifest[];
  env: RuntimeEnv;
  runLogger: {
    info: (message: string, data?: Record<string, unknown>) => void;
  };
  traceFile: string;
}): Promise<void> {
  const { convex, run, specialist, allowedTools, env, runLogger, traceFile } = params;
  const prompt = await loadPrompt(specialist.promptFile);
  const context = await loadContext(specialist.contextFiles);
  const systemInstruction = buildSystemInstruction([prompt, context]);

  const workflowResult = await runWorkflow({
    convex,
    run,
    session: params.session,
    specialist,
    allowedTools,
    env,
    runLogger,
    traceFile,
    baseSystemInstruction: systemInstruction,
  });
  if (workflowResult) {
    if (workflowResult.status === "handoff_to_open_loop") {
      runLogger.info("workflow_handoff_to_open_loop", {
        workflowName: workflowResult.workflowName,
      });
    } else {
      await finalizeSuccessfulRun(convex, run, workflowResult.outputText);
      await appendTraceEvent(traceFile, "run_finished", {
        timestamp: new Date().toISOString(),
        outputText: workflowResult.outputText,
        workflowName: workflowResult.workflowName,
      });
      runLogger.info("run_finished", {
        outputText: workflowResult.outputText,
        workflowName: workflowResult.workflowName,
      });
      return;
    }
  }

  const loopResult = await runOpenLoop({
    convex,
    run,
    specialist,
    allowedTools,
    env,
    runLogger,
    traceFile,
    baseSystemInstruction: systemInstruction,
  });

  if (loopResult.status === "waiting_on_human") {
    await createFinalizeStep(
      convex,
      run,
      "Run paused while waiting on a human tool response.",
      "completed",
    );
    runLogger.info("run_waiting_on_human");
    return;
  }

  await finalizeSuccessfulRun(convex, run, loopResult.outputText);
  await appendTraceEvent(traceFile, "run_finished", {
    timestamp: new Date().toISOString(),
    outputText: loopResult.outputText,
  });
  runLogger.info("run_finished", {
    outputText: loopResult.outputText,
  });
}
