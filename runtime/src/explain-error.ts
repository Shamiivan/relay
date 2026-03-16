import type { ModelAdapter } from "../../packages/model/src";

export type ExplainErrorInput = {
  action: string;
  toolName: string;
  error: unknown;
};

/**
 * Turns a structured tool failure into short user-facing language.
 * This keeps tools deterministic while letting the model adapt the final wording.
 */
export async function explainError(
  adapter: ModelAdapter,
  input: ExplainErrorInput,
): Promise<string> {
  const request = {
    systemInstruction: [
      "You explain tool failures to end users.",
      "Be concise.",
      "Do not expose raw internal jargon unless needed.",
      "Say what action failed and why in plain language.",
      "If a next step is obvious, mention it in one short sentence.",
      "Return plain text only.",
    ].join(" "),
    messages: [
      {
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: JSON.stringify(input),
          },
        ],
      },
    ],
    tools: [],
  };

  adapter.validate(request.messages);
  const response = await adapter.generate(request);
  return response.text.trim() || "I hit an error while trying to complete that action.";
}
