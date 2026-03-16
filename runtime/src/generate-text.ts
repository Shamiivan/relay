import type { ModelAdapter } from "../../packages/model/src";

export type GenerateTextInput = {
  systemInstruction: string;
  prompt: string;
};

/**
 * Shared helper for one-shot text generation inside routines.
 */
export async function generateText(
  adapter: ModelAdapter,
  input: GenerateTextInput,
): Promise<string> {
  const request = {
    systemInstruction: input.systemInstruction,
    messages: [
      {
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: input.prompt,
          },
        ],
      },
    ],
    tools: [],
  };

  adapter.validate(request.messages);
  const response = await adapter.generate(request);
  return response.text.trim();
}
