import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadDotenv } from "../packages/env/src/index.ts";
import { createModelAdapter } from "../packages/model/src/provider.ts";
import { runWorkflowLoop } from "../runtime/src/poc/workflow-loop.ts";
import { pocWorkflows } from "../runtime/src/poc/workflow-registry.ts";
import { selectWorkflow } from "../runtime/src/poc/workflow-router.ts";
import { Thread } from "../runtime/src/primitives/thread.ts";

const envSchema = z.object({
  MODEL_PROVIDER: z.string().default("gemini"),
  MODEL_NAME: z.string().default("gemini-2.5-flash"),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
});

function loadModelEnv() {
  loadDotenv();
  const env = envSchema.parse(process.env);
  const apiKey = env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim() || "";

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY.");
  }

  return {
    MODEL_PROVIDER: env.MODEL_PROVIDER,
    MODEL_NAME: env.MODEL_NAME,
    GEMINI_API_KEY: apiKey,
  };
}

function getUserInput(): string {
  const input = process.argv
    .slice(2)
    .filter((arg) => arg !== "--")
    .join(" ")
    .trim();

  if (!input) {
    throw new Error("Usage: pnpm tsx playground/index.ts -- \"your message\"");
  }

  return input;
}

async function main() {
  const adapter = createModelAdapter(loadModelEnv());
  const input = getUserInput();
  const traceLines: string[] = [];
  const log = (line: string) => {
    traceLines.push(line);
    console.log(line);
  };
  log("Starting board-meeting-prep POC loop...");
  const thread = new Thread({
    state: {},
    events: [
      {
        type: "user_message",
        data: input,
      },
    ],
  });
  const availableWorkflows = pocWorkflows;

  const selectedWorkflow = await selectWorkflow({
    adapter,
    thread,
    availableWorkflows,
    log,
  });


  // if no workflow selected, save the thread and exit
  if (selectedWorkflow.type !== "workflow_selected") {
    const outputDir = path.join(process.cwd(), ".relay", "mockups", "board-meeting-prep-poc");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(
      outputDir,
      `${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    const tracePath = outputPath.replace(/\.json$/, ".log");

    writeFileSync(outputPath, JSON.stringify({
      events: selectedWorkflow.thread.events,
      serializedThread: selectedWorkflow.thread.serializeForLLM(),
    }, null, 2));
    writeFileSync(tracePath, traceLines.join("\n"));

    console.log(JSON.stringify({
      events: selectedWorkflow.thread.events,
      savedTo: outputPath,
      traceSavedTo: tracePath,
    }, null, 2));
    console.log("Done.");
    return;
  }
  const result = await runWorkflowLoop({
    adapter,
    thread: selectedWorkflow.thread,
    workflow: selectedWorkflow.workflow,
    log,
  });

  const outputDir = path.join(process.cwd(), ".relay", "mockups", "board-meeting-prep-poc");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  const tracePath = outputPath.replace(/\.json$/, ".log");

  writeFileSync(outputPath, JSON.stringify({
    events: result.events,
    serializedThread: result.serializeForLLM(),
  }, null, 2));
  writeFileSync(tracePath, traceLines.join("\n"));

  console.log(JSON.stringify({
    events: result.events,
    savedTo: outputPath,
    traceSavedTo: tracePath,
  }, null, 2));
  console.log("Done.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
