import type {
  ModelAdapter,
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

const GEMINI_SCHEMA_KEYS = new Set([
  "type",
  "format",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "propertyOrdering",
  "anyOf",
]);

function sanitizeGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeGeminiSchema(item))
      .filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const schema = value as Record<string, unknown>;
  const sanitizedEntries = Object.entries(schema)
    .filter(([key]) => GEMINI_SCHEMA_KEYS.has(key))
    .map(([key, childValue]) => {
      if (key === "properties" && childValue && typeof childValue === "object") {
        // Property names are user-defined — don't filter them through GEMINI_SCHEMA_KEYS
        const sanitized = Object.fromEntries(
          Object.entries(childValue as Record<string, unknown>)
            .map(([prop, propSchema]) => [prop, sanitizeGeminiSchema(propSchema)])
            .filter(([, v]) => v !== undefined),
        );
        return [key, Object.keys(sanitized).length > 0 ? sanitized : undefined] as const;
      }
      return [key, sanitizeGeminiSchema(childValue)] as const;
    })
    .filter(([, childValue]) => childValue !== undefined);

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  const result = Object.fromEntries(sanitizedEntries) as Record<string, unknown>;

  // `required` and `propertyOrdering` reference property names — keep them consistent with `properties`
  const props = result.properties as Record<string, unknown> | undefined;
  for (const key of ["required", "propertyOrdering"] as const) {
    if (!Array.isArray(result[key])) continue;
    if (!props) {
      delete result[key];
    } else {
      result[key] = (result[key] as string[]).filter((k) => k in props);
      if ((result[key] as string[]).length === 0) delete result[key];
    }
  }

  return result;
}

function toGeminiTool(tool: ModelRequest["tools"][number]): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    parameters: sanitizeGeminiSchema(tool.parameters) ?? { type: "object" },
  };
}

function toGeminiPayload(request: ModelRequest): Record<string, unknown> {
  return {
    system_instruction: {
      parts: [{ text: request.systemInstruction }],
    },
    contents: request.messages.map(toGeminiContent),
    tools: [
      {
        functionDeclarations: request.tools.map(toGeminiTool),
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

export function createGeminiClient(env: GeminiEnv): ModelAdapter {
  return {
    validate(messages: ModelMessage[]): void {
      if (messages.length === 0) {
        throw new Error("Cannot call Gemini without at least one message.");
      }

      if (messages[messages.length - 1]?.role === "model") {
        throw new Error("Cannot continue Gemini request from a trailing model message.");
      }
    },
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
