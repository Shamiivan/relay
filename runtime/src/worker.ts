/**
 * Local worker that claims pending runs and dispatches them into the runtime loop.
 * Provider SDKs and filesystem access stay out of Convex.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { SpecialistConfig } from "../../packages/contracts/src";
import { specialistConfigSchema } from "../../packages/contracts/src";
import { createLogger } from "../../packages/logger/src";
import { loadRuntimeEnv } from "./env";
import { finalizeFailedRun } from "./execution/finalize-run";
import { runLoop } from "./execution/run-loop";
import { createTraceFilePath, initializeTraceFile, appendTraceEvent } from "./tracing/trace-file";
import { getAllowedTools } from "./tools/tool-registry";

function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

async function loadSpecialistConfig(specialistId: string): Promise<SpecialistConfig> {
  const raw = await fs.readFile(
    repoPath(`configs/specialists/${specialistId}.json`),
    "utf8",
  );

  return specialistConfigSchema.parse(JSON.parse(raw));
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

async function processRun(
  convex: ConvexClient,
  run: Doc<"runs">,
  env: ReturnType<typeof loadRuntimeEnv>,
  processLogger: ReturnType<typeof createLogger>,
): Promise<void> {
  const runLogger = processLogger.child({
    runId: run._id,
    specialistId: run.specialistId,
    userId: run.userId,
  });

  const specialist = await loadSpecialistConfig(run.specialistId);
  const prompt = await loadPrompt(specialist.promptFile);
  const context = await loadContext(specialist.contextFiles);
  const traceFile = createTraceFilePath(env.TRACE_DIR);
  await initializeTraceFile(traceFile, run, env, prompt, context);

  try {
    const session = await convex.query(api.sessions.get, {
      sessionId: run.sessionId,
    });
    if (!session) {
      throw new Error(`Missing session for run ${run._id}`);
    }

    runLogger.info("run_started", {
      message: run.message,
      turnCount: run.turnCount,
      executionMode: run.executionMode,
    });
    await runLoop({
      convex,
      run,
      session,
      specialist,
      allowedTools: getAllowedTools(specialist.tools),
      env,
      runLogger,
      traceFile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker failure";
    await finalizeFailedRun(convex, run, "internal_error", message);
    await appendTraceEvent(traceFile, "run_failed", {
      timestamp: new Date().toISOString(),
      message,
    });
    runLogger.error("run_failed", {
      error,
    });
  }
}

export function startWorker(): void {
  const env = loadRuntimeEnv();
  const processLogger = createLogger({
    level: env.LOG_LEVEL,
    service: "worker",
  });
  const convex = new ConvexClient(env.CONVEX_URL);

  convex.onUpdate(api.runs.listTodo, {}, async (pendingRuns) => {
    if (pendingRuns.length === 0) {
      return;
    }

    processLogger.info("pending_runs_detected", {
      count: pendingRuns.length,
    });

    for (; ;) {
      const run = await convex.mutation(api.runs.claim, {});
      if (!run) {
        break;
      }

      processLogger.info("run_claimed", {
        runId: run._id,
      });
      await processRun(convex, run, env, processLogger);
    }
  });

  processLogger.info("worker_started", {
    modelProvider: env.MODEL_PROVIDER,
    modelName: env.MODEL_NAME,
  });
}

startWorker();
