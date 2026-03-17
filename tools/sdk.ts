import type { ModelTool } from "../packages/model/src";
import { z } from "zod";
import { readJsonInput, writeJsonOutput } from "./lib/json-stdio";

export const toolCapabilityValues = [
  "search",
  "read",
  "create",
  "update",
  "delete",
] as const;

export const toolUpdateModeValues = [
  "replace",
  "patch",
  "append",
  "granular",
] as const;

export type ToolCapability = (typeof toolCapabilityValues)[number];
export type ToolUpdateMode = (typeof toolUpdateModeValues)[number];

export const toolErrorSchema = z.object({
  type: z.string().min(1),
  message: z.string().optional(),
  field: z.string().optional(),
  reason: z.string().optional(),
  retryAfterMs: z.number().int().positive().optional(),
  id: z.string().optional(),
}).passthrough();

export type ToolPrompt = {
  files: readonly string[];
};

export function promptFile(file: string): ToolPrompt {
  return { files: [file] };
}

export function promptParts(...files: string[]): ToolPrompt {
  return { files };
}

export type ToolHandler<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> = (ctx: {
  input: z.output<TInput>;
}) => Promise<z.input<TOutput> | z.output<TOutput>> | z.input<TOutput> | z.output<TOutput>;

export type ToolErrorHandler<TOutput extends z.ZodType = z.ZodType> = (
  error: unknown,
) => Promise<z.input<TOutput> | z.output<TOutput>> | z.input<TOutput> | z.output<TOutput>;

export type ToolDeclaration<
  TName extends string = string,
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> = {
  readonly __toolDeclaration: true;
  moduleUrl?: string;
  name: TName;
  resource: string;
  capability: ToolCapability;
  description: string;
  destructive?: boolean;
  idempotent?: boolean;
  updateMode?: ToolUpdateMode;
  input: TInput;
  output: TOutput;
  prompt: ToolPrompt;
  handler: ToolHandler<TInput, TOutput>;
  onError?: ToolErrorHandler<TOutput>;
};

export type ToolManifest = {
  name: string;
  resource: string;
  capability: ToolCapability;
  description: string;
  destructive?: boolean;
  idempotent?: boolean;
  updateMode?: ToolUpdateMode;
  parameters: Record<string, unknown>;
  command: string[];
  prompt: string;
};

export type InferToolInput<TTool extends ToolDeclaration> = z.input<TTool["input"]>;
export type InferToolOutput<TTool extends ToolDeclaration> = z.output<TTool["output"]>;

export function defineTool<
  TName extends string,
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
>(tool: Omit<ToolDeclaration<TName, TInput, TOutput>, "__toolDeclaration">): ToolDeclaration<
  TName,
  TInput,
  TOutput
> {
  return {
    __toolDeclaration: true,
    ...tool,
  };
}

export function isToolDeclaration(value: unknown): value is ToolDeclaration {
  return typeof value === "object"
    && value !== null
    && "__toolDeclaration" in value
    && (value as { __toolDeclaration?: unknown }).__toolDeclaration === true;
}

export function toModelTool(manifest: ToolManifest): ModelTool {
  return {
    name: manifest.name,
    description: manifest.description,
    parameters: manifest.parameters,
  };
}

export async function runDeclaredTool<TTool extends ToolDeclaration>(
  tool: TTool,
): Promise<void> {
  try {
    const input = tool.input.parse(await readJsonInput());
    const result = await tool.handler({ input });
    writeJsonOutput(tool.output.parse(result));
  } catch (error) {
    if (tool.onError) {
      writeJsonOutput(tool.output.parse(await tool.onError(error)));
      return;
    }

    throw error;
  }
}

export async function executeTool<TTool extends ToolDeclaration>(
  execute: (toolName: string, args: unknown) => Promise<unknown>,
  tool: TTool,
  input: InferToolInput<TTool>,
): Promise<InferToolOutput<TTool>> {
  const parsedInput = tool.input.parse(input);
  const result = await execute(tool.name, parsedInput);
  return tool.output.parse(result) as InferToolOutput<TTool>;
}
