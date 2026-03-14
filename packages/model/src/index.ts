export type ModelTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ModelPart =
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; args: unknown }
  | { type: "tool_result"; name: string; result: unknown };

export type ModelMessage = {
  role: "user" | "model";
  parts: ModelPart[];
};

export type ModelResponse = {
  parts: ModelPart[];
  text: string;
  toolCalls: Array<{ name: string; args: unknown }>;
};

export type ModelRequest = {
  systemInstruction: string;
  messages: ModelMessage[];
  tools: ModelTool[];
};

export interface ModelAdapter {
  validate(messages: ModelMessage[]): void;
  toProviderPayload(request: ModelRequest): unknown;
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export type ModelClient = ModelAdapter;
