import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ZodTypeAny } from "zod";
import type { IntentDeclaration } from "../execution/determine-next-step/contract.ts";

export abstract class Task {
  abstract readonly name: string;
  abstract readonly intent: IntentDeclaration;
  abstract readonly input: ZodTypeAny;
  abstract readonly output: ZodTypeAny;
  abstract readonly promptFiles: readonly string[];

  protected abstract execute(input: unknown): Promise<unknown> | unknown;

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
    return [`# Task: ${this.name}`, body].filter(Boolean).join("\n");
  }

  protected abstract get moduleUrl(): string;
}
