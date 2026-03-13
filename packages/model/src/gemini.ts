import type {
  ModelClient,
  ModelMessage,
  ModelPart,
  ModelRequest,
  ModelResponse,
} from "./index";

type GeminiEnv = {
  GEMINI_API_KEY: string;
  MODEL_NAME: string;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        functionCall?: {
          name?: string;
          args?: unknown;
        };
      }>;
    };
  }>;
};

function toGeminiPayload(request: ModelRequest): Record<string, unknown> {
  return {
    system_instruction: {
      parts: [{ text: request.systemInstruction }],
    },
    contents: request.messages.map(toGeminiContent),
    tools: [
      {
        functionDeclarations: request.tools,
      },
    ],
  };
}

function toGeminiPart(part: ModelPart): Record<string, unknown> {
  if (part.type === "text") {
    return { text: part.text };
  }

  if (part.type === "tool_call") {
    return {
      functionCall: {
        name: part.name,
        args: part.args,
      },
    };
  }

  return {
    functionResponse: {
      name: part.name,
      response: {
        result: part.result,
      },
    },
  };
}

function toGeminiContent(message: ModelMessage): Record<string, unknown> {
  return {
    role: message.role,
    parts: message.parts.map(toGeminiPart),
  };
}

function parseResponse(response: GeminiGenerateResponse): ModelResponse {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const parsedParts: ModelPart[] = [];
  const toolCalls: Array<{ name: string; args: unknown }> = [];
  const textChunks: string[] = [];

  for (const part of parts) {
    if (typeof part.text === "string" && part.text.trim()) {
      parsedParts.push({ type: "text", text: part.text });
      textChunks.push(part.text);
    }

    const functionCall = part.functionCall;
    if (functionCall?.name) {
      const toolCall = { name: functionCall.name, args: functionCall.args ?? {} };
      parsedParts.push({ type: "tool_call", ...toolCall });
      toolCalls.push(toolCall);
    }
  }

  return {
    parts: parsedParts,
    text: textChunks.join("\n").trim(),
    toolCalls,
  };
}

export function createGeminiClient(env: GeminiEnv): ModelClient {
  return {
    toProviderPayload(request: ModelRequest): Record<string, unknown> {
      return toGeminiPayload(request);
    },
    async generate(request: ModelRequest): Promise<ModelResponse> {
      const payload = toGeminiPayload(request);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.MODEL_NAME}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
      }

      const data = (await response.json()) as GeminiGenerateResponse;
      return parseResponse(data);
    },
  };
}
