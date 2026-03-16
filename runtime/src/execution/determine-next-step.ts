import { z } from "zod";
import type { ModelAdapter } from "../../../packages/model/src";
import type { Thread } from "../primitives/thread";
import {
  determineNextStepContract,
  type IntentDeclaration,
  type DetermineNextStepOutput,
} from "./determine-next-step.contract";
import type { NextStep } from "./run-loop-v2";

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

export type DetermineNextStepResult = {
  request: {
    systemInstruction: string;
    prompt: string;
  };
  rawText: string;
  parsed: DetermineNextStepOutput;
  nextStep: NextStep;
  adapterResponse: unknown;
  providerPayload?: unknown;
  rawProviderResponse?: unknown;
};

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

function mapIntentToNextStep(parsed: DetermineNextStepOutput): NextStep {
  if (parsed.intent === "request_more_information") {
    return {
      type: "request_human_clarification",
      prompt: parsed.message,
    };
  }

  return {
    type: "done_for_now",
    message: parsed.message,
  };
}

export async function determineNextStepDetailed(
  adapter: ModelAdapter,
  thread: Thread,
): Promise<DetermineNextStepResult> {
  const prompt = buildDetermineNextStepPrompt(thread);
  const request = {
    systemInstruction: "You are a helpful assistant that decides the next step.",
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

  adapter.validate(request.messages);
  const detailedResponse = adapter.generateWithDebug
    ? await adapter.generateWithDebug(request)
    : {
      response: await adapter.generate(request),
      debug: undefined,
    };
  const response = detailedResponse.response;
  const parsed = determineNextStepSchema.parse(parseJsonResponse(response.text));

  return {
    request: {
      systemInstruction: request.systemInstruction,
      prompt,
    },
    rawText: response.text,
    parsed,
    nextStep: mapIntentToNextStep(parsed),
    adapterResponse: response,
    providerPayload: detailedResponse.debug?.providerPayload,
    rawProviderResponse: detailedResponse.debug?.rawProviderResponse,
  };
}

export async function determineNextStep(
  adapter: ModelAdapter,
  thread: Thread,
): Promise<NextStep> {
  const result = await determineNextStepDetailed(adapter, thread);
  return result.nextStep;
}

export const determineNextStepSchemas = {
  determineNextStep: determineNextStepSchema,
  variants: determineNextStepVariants,
};
