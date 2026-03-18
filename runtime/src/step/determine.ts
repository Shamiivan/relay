import { z } from "zod";
import type { ModelAdapter } from "../../../packages/model/src/index.ts";
import { composeContext } from "../context/sections.ts";
import type { Thread, ThreadData } from "../thread.ts";
import type { NextStep } from "./next-step.ts";
import type { IntentDeclaration } from "./contract.ts";
import { createIntentSchema, parseJsonResponse, renderOutputFormat } from "./compiler.ts";
import type { StepContext } from "./context.ts";

function buildPrompt(args: {
  thread: Thread;
  context: StepContext;
}): string {
  const threadSection = [
    "You are working on the following thread:",
    "",
    args.thread.serializeForLLM(),
  ].join("\n");

  const extraContext = composeContext(args.context.sections);

  return [
    threadSection,
    extraContext,
    "What should the next step be?",
    "",
    renderOutputFormat(args.context.contract),
    "",
    "Think carefully about the next step before answering.",
    "Return JSON only.",
    "Do not use markdown fences.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildSchema(contract: readonly IntentDeclaration[]): z.ZodTypeAny {
  const variants = contract.map((declaration) => createIntentSchema(declaration));
  if (variants.length === 0) {
    throw new Error("Determine-next-step contract must contain at least one intent.");
  }

  if (variants.length === 1) {
    return variants[0];
  }

  return z.union(variants as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

function mapParsedIntentToNextStep(parsed: Record<string, unknown>): NextStep {
  if (parsed.intent === "request_more_information") {
    return {
      type: "request_human_clarification",
      prompt: String(parsed.message ?? ""),
    };
  }

  if (parsed.intent === "done_for_now") {
    return {
      type: "done_for_now",
      message: String(parsed.message ?? ""),
    };
  }

  const { intent, ...args } = parsed;
  return {
    type: "executable",
    executableName: String(intent),
    args: args as ThreadData,
  };
}

export async function determineNextStep(args: {
  adapter: ModelAdapter;
  thread: Thread;
  context: StepContext;
}): Promise<{
  prompt: string;
  rawText: string;
  parsed: Record<string, unknown>;
  nextStep: NextStep;
}> {
  const { contract } = args.context;
  if (contract.length === 0) {
    throw new Error("determineNextStep requires a non-empty contract.");
  }

  const prompt = buildPrompt({ thread: args.thread, context: args.context });
  const schema = buildSchema(contract);
  const request = {
    systemInstruction: args.context.systemInstruction,
    messages: [
      {
        role: "user" as const,
        parts: [{ type: "text" as const, text: prompt }],
      },
    ],
    tools: [],
  };

  args.adapter.validate(request.messages);
  const response = await args.adapter.generate(request);
  let parsed: Record<string, unknown>;

  try {
    parsed = schema.parse(parseJsonResponse(response.text)) as Record<string, unknown>;
  } catch (error) {
    console.log("\n[determine_next_step.parse_error.raw_text]");
    console.log(response.text);
    throw error;
  }

  return {
    prompt,
    rawText: response.text,
    parsed,
    nextStep: mapParsedIntentToNextStep(parsed),
  };
}
