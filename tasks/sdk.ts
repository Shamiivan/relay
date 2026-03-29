import { z } from "zod";
import { JsonStdinError, readJsonInput, writeJsonOutput } from "../tools/lib/json-stdio";

export type TaskPrompt = {
  files: readonly string[];
};

export function promptFile(file: string): TaskPrompt {
  return { files: [file] };
}

export type TaskHandler<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> = (ctx: {
  input: z.output<TInput>;
}) => Promise<z.input<TOutput> | z.output<TOutput>> | z.input<TOutput> | z.output<TOutput>;

export type TaskErrorInfo = { type: string; message?: string };

export type TaskErrorHandler = (
  error: unknown,
) => Promise<TaskErrorInfo> | TaskErrorInfo;

export type TaskDeclaration<
  TName extends string = string,
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> = {
  readonly __taskDeclaration: true;
  moduleUrl?: string;
  name: TName;
  description: string;
  input: TInput;
  output: TOutput;
  prompt: TaskPrompt;
  handler: TaskHandler<TInput, TOutput>;
  onError?: TaskErrorHandler;
};

export function defineTask<
  TName extends string,
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
>(task: Omit<TaskDeclaration<TName, TInput, TOutput>, "__taskDeclaration">): TaskDeclaration<
  TName,
  TInput,
  TOutput
> {
  return {
    __taskDeclaration: true,
    ...task,
  };
}

export async function runDeclaredTask<TTask extends TaskDeclaration>(
  task: TTask,
): Promise<void> {
  try {
    const input = task.input.parse(await readJsonInput());
    const rawResult = await task.handler({ input });
    writeJsonOutput({ ok: true, result: task.output.parse(rawResult) });
  } catch (error) {
    if (error instanceof JsonStdinError) {
      writeJsonOutput({ ok: false, error: { type: "invalid_input", message: error.message } });
      return;
    }
    if (task.onError) {
      writeJsonOutput({ ok: false, error: await task.onError(error) });
      return;
    }
    writeJsonOutput({
      ok: false,
      error: {
        type: "internal_error",
        message: error instanceof Error ? error.message : "Unknown task error",
      },
    });
  }
}
