import { z } from "zod";
import type { ModelAdapter } from "../../../../packages/model/src/index.ts";
import type { ContextSection } from "../../context/sections.ts";
import { composeContext } from "../../context/sections.ts";
import type { Thread, ThreadData } from "../../primitives/thread.ts";
import type { NextStep } from "../next-step.ts";
import type { IntentDeclaration } from "./contract.ts";
import { createIntentSchema, parseJsonResponse, renderOutputFormat } from "./compiler.ts";

export function buildExplicitDetermineNextStepPrompt(args: {
  thread: Thread;
  contract: readonly IntentDeclaration[];
  sections?: ContextSection[];
}): string {
  const threadSection = [
    "You are working on the following thread:",
    "",
    args.thread.serializeForLLM(),
  ].join("\n");

  const extraContext = composeContext(args.sections ?? []);

  return [
    threadSection,
    extraContext,
    "What should the next step be?",
    "",
    renderOutputFormat(args.contract),
    "",
    "Think carefully about the next step before answering.",
    "Return JSON only.",
    "Do not use markdown fences.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildExplicitDetermineNextStepSchema(
  contract: readonly IntentDeclaration[],
): z.ZodTypeAny {
  const variants = contract.map((declaration) => createIntentSchema(declaration));
  if (variants.length === 0) {
    throw new Error("Explicit determine-next-step contract must contain at least one intent.");
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

export async function determineNextStepExplicit(args: {
  adapter: ModelAdapter;
  thread: Thread;
  systemInstruction?: string;
}): Promise<{
  prompt: string;
  rawText: string;
  parsed: Record<string, unknown>;
  nextStep: NextStep;
}> {
  const contract = args.thread.determineNextStepContract;
  if (contract.length === 0) {
    throw new Error("determineNextStepExplicit requires thread determine-next-step contract.");
  }
  const prompt = buildExplicitDetermineNextStepPrompt({
    thread: args.thread,
    contract,
    sections: args.thread.determineNextStepSections,
  });
  const schema = buildExplicitDetermineNextStepSchema(contract);
  const request = {
    systemInstruction: args.systemInstruction ?? "You are a helpful assistant that decides the next step.",
    messages: [
      {
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: prompt,
          },
        ],
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
