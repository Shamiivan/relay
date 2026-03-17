import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ZodTypeAny } from "zod";
import { z } from "zod";
import {
  defineIntent,
  field,
  type IntentDeclaration,
} from "../runtime/src/execution/determine-next-step/contract.ts";
import {
  defineTool,
  runDeclaredTool,
  type ToolDeclaration,
} from "./sdk";

export abstract class Tool {
  abstract readonly name: string;
  abstract readonly intent: IntentDeclaration;
  abstract readonly input: ZodTypeAny;
  abstract readonly output: ZodTypeAny;
  abstract readonly promptFiles: readonly string[];

  protected abstract execute(input: unknown): Promise<unknown> | unknown;

  protected onError(_error: unknown): Promise<unknown> | unknown {
    throw new Error("Tool error handler not implemented.");
  }

  toToolDeclaration() {
    return defineTool({
      name: this.name,
      resource: this.intent.intent,
      capability: "read",
      description: this.intent.description ?? this.intent.name,
      input: this.input,
      output: this.output,
      prompt: { files: this.promptFiles },
      handler: async ({ input }) => await this.execute(input),
      onError: Object.hasOwn(this, "onError")
        ? async (error) => await this.onError(error)
        : undefined,
    });
  }

  async run(input: unknown): Promise<unknown> {
    const parsedInput = this.input.parse(input);
    const result = await this.execute(parsedInput);
    return this.output.parse(result);
  }

  async renderPromptSection(): Promise<string> {
    const parts = await Promise.all(
      this.promptFiles.map(async (file) => {
        const content = await fs.readFile(fileURLToPath(new URL(file, this.moduleUrl)), "utf8");
        return content.trim();
      }),
    );

    const body = parts.filter(Boolean).join("\n\n").trim();
    return [`# Tool: ${this.name}`, body].filter(Boolean).join("\n");
  }

  protected abstract get moduleUrl(): string;
}

export async function runPromptBackedTool(tool: Tool): Promise<void> {
  await runDeclaredTool(tool.toToolDeclaration());
}

export async function renderToolPromptSections(tools: Tool[]): Promise<string> {
  const sections = await Promise.all(
    tools.map(async (tool) => await tool.renderPromptSection()),
  );

  return sections.filter(Boolean).join("\n\n");
}

function toFieldDeclaration(schema: Record<string, unknown>, fallbackDescription?: string) {
  if (schema.type === "string") {
    return field.string(fallbackDescription);
  }

  if (schema.type === "number" || schema.type === "integer") {
    return field.number(fallbackDescription);
  }

  if (schema.type === "boolean") {
    return field.boolean(fallbackDescription);
  }

  return field.string(fallbackDescription);
}

export class DeclaredToolAdapter extends Tool {
  readonly name: string;
  readonly intent: IntentDeclaration;
  readonly input: ZodTypeAny;
  readonly output: ZodTypeAny;
  readonly promptFiles: readonly string[];
  readonly declaration: ToolDeclaration;
  readonly declarationModuleUrl: string;

  constructor(args: {
    declaration: ToolDeclaration;
    intent?: IntentDeclaration;
  }) {
    super();
    this.declaration = args.declaration;
    this.name = args.declaration.name;
    this.input = args.declaration.input;
    this.output = args.declaration.output;
    this.promptFiles = args.declaration.prompt.files;
    this.declarationModuleUrl = args.declaration.moduleUrl ?? import.meta.url;
    this.intent = args.intent ?? defineIntent({
      name: this.declaration.name.replace(/\W+/g, "_"),
      intent: this.declaration.name,
      description: this.declaration.description,
      fields: Object.fromEntries(
        Object.entries(z.toJSONSchema(this.declaration.input, { io: "input" }).properties ?? {}).map(
          ([fieldName, schema]) => {
            const propertySchema = schema as Record<string, unknown>;
            return [
              fieldName,
              toFieldDeclaration(
                propertySchema,
                typeof propertySchema.description === "string" ? propertySchema.description : undefined,
              ),
            ];
          },
        ),
      ),
    });
  }

  protected get moduleUrl(): string {
    return this.declarationModuleUrl;
  }

  protected async execute(input: unknown): Promise<unknown> {
    return await this.declaration.handler({
      input: this.declaration.input.parse(input),
    });
  }

  protected override async onError(error: unknown): Promise<unknown> {
    if (!this.declaration.onError) {
      throw error;
    }

    return await this.declaration.onError(error);
  }
}
