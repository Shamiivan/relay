import { z } from "zod";
import type { Thread } from "../../primitives/thread";
import {
  determineNextStepContract,
  type IntentDeclaration,
  type DetermineNextStepOutput,
} from "./contract";

export function createIntentSchema<TIntent extends string>(declaration: IntentDeclaration & { intent: TIntent }) {
  const shape: Record<string, z.ZodTypeAny> = {
    intent: z.literal(declaration.intent),
  };

  for (const [fieldName, field] of Object.entries(declaration.fields)) {
    if (field.type === "string") {
      shape[fieldName] = z.string().min(1);
      continue;
    }

    if (field.type === "number") {
      shape[fieldName] = z.number();
      continue;
    }

    if (field.type === "boolean") {
      shape[fieldName] = z.boolean();
    }
  }

  return z.object(shape);
}

export const determineNextStepVariants = determineNextStepContract.map((declaration) =>
  createIntentSchema(declaration)
) as unknown as [
  z.ZodTypeAny,
  ...z.ZodTypeAny[],
];

export const determineNextStepSchema =
  z.union(determineNextStepVariants) as unknown as z.ZodType<DetermineNextStepOutput>;

export function renderOutputFormat(contract: readonly IntentDeclaration[]): string {
  return [
    "Answer in JSON using any of these schemas:",
    ...contract.flatMap((declaration, index) => {
      const lines = [
        "{",
        ...(declaration.description ? [`  // ${declaration.description}`] : []),
        `  intent: "${declaration.intent}",`,
        ...Object.entries(declaration.fields).flatMap(([fieldName, field]) => [
          ...(field.description ? [`  // ${field.description}`] : []),
          `  ${fieldName}: ${field.type},`,
        ]),
        "}",
      ];

      return index === contract.length - 1
        ? lines
        : [...lines, "or"];
    }),
  ].join("\n");
}

export function buildDetermineNextStepPrompt(thread: Thread): string {
  return [
    "You are working on the following thread:",
    "",
    thread.serializeForLLM(),
    "",
    "What should the next step be?",
    "",
    renderOutputFormat(determineNextStepContract),
    "",
    "Think carefully about the next step before answering.",
    "Return JSON only.",
    "Do not use markdown fences.",
  ].join("\n");
}

export function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const withoutFence = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    return JSON.parse(withoutFence);
  }
}

export const determineNextStepSchemas = {
  determineNextStep: determineNextStepSchema,
  variants: determineNextStepVariants,
};
