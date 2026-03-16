import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadDotenv } from "../packages/env/src";
import { createModelAdapter } from "../packages/model/src/provider";
import { determineNextStepDetailed } from "../runtime/src/execution/determine-next-step";
import { Thread } from "../runtime/src/primitives/thread";

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
    throw new Error("Usage: pnpm playground:play -- \"your message\"");
  }

  return input;
}

function saveMockup(input: string, result: Awaited<ReturnType<typeof determineNextStepDetailed>>): string {
  const outputDir = path.join(process.cwd(), ".relay", "mockups", "determine-next-step");
  mkdirSync(outputDir, { recursive: true });

  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const outputPath = path.join(outputDir, filename);

  writeFileSync(outputPath, JSON.stringify({
    input,
    request: result.request,
    providerPayload: result.providerPayload,
    rawProviderResponse: result.rawProviderResponse,
    adapterResponse: result.adapterResponse,
    rawText: result.rawText,
    parsed: result.parsed,
    nextStep: result.nextStep,
  }, null, 2));

  return outputPath;
}

async function main() {
  const adapter = createModelAdapter(loadModelEnv());
  const input = getUserInput();
  const thread = new Thread({
    session: {} as never,
    run: {} as never,
    state: {},
    events: [
      {
        type: "user_message",
        data: input,
      },
    ],
  });

  const result = await determineNextStepDetailed(adapter, thread);
  const outputPath = saveMockup(input, result);

  console.log(JSON.stringify({
    request: result.request,
    providerPayload: result.providerPayload,
    rawProviderResponse: result.rawProviderResponse,
    adapterResponse: result.adapterResponse,
    rawText: result.rawText,
    parsed: result.parsed,
    nextStep: result.nextStep,
    savedTo: outputPath,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
