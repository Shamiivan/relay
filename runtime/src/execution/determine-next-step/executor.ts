import type { ModelAdapter } from "../../../../packages/model/src";
import type { Thread } from "../../primitives/thread";
import type { NextStep } from "../run-loop-v2";
import type { DetermineNextStepOutput } from "./contract";
import {
  buildDetermineNextStepPrompt,
  determineNextStepSchema,
  parseJsonResponse,
} from "./compiler";

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
