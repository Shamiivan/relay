import { z } from "zod";
import type { SpecialistConfig } from "../packages/contracts/src";
import type { RunDoc } from "../runtime/src/primitives/run";
import type { SessionDoc } from "../runtime/src/primitives/session";
import type { ToolManifest } from "../runtime/src/tools";
import type { InferToolInput, InferToolOutput, ToolDeclaration } from "../tools/sdk";

export type WorkflowPrompt = {
  files: readonly string[];
};

export function promptFile(file: string): WorkflowPrompt {
  return { files: [file] };
}

export function promptParts(...files: string[]): WorkflowPrompt {
  return { files };
}

export type WorkflowToolExecutor = {
  getTool: (toolName: string) => ToolManifest | undefined;
  execute: (toolName: string, args: unknown) => Promise<unknown>;
  executeTool: <TTool extends ToolDeclaration>(
    tool: TTool,
    args: InferToolInput<TTool>,
  ) => Promise<InferToolOutput<TTool>>;
};

export type WorkflowTriggerContext = {
  run: RunDoc;
  session: SessionDoc;
  specialist: SpecialistConfig;
};

export type WorkflowStepResult<
  TState extends z.ZodType = z.ZodType,
  TStepName extends string = string,
> = {
  state: z.input<TState> | z.output<TState>;
  nextStep?: TStepName;
  outputText?: string;
  summaryText?: string;
  handoffToOpenLoop?: boolean;
};

export type WorkflowStepContext<
  TState extends z.ZodType = z.ZodType,
  TStepName extends string = string,
> = {
  run: RunDoc;
  session: SessionDoc;
  specialist: SpecialistConfig;
  state: z.output<TState>;
  stepName: TStepName;
  tools: WorkflowToolExecutor;
  explainError: (input: { action: string; toolName: string; error: unknown }) => Promise<string>;
  generateText: (input: { systemInstruction: string; prompt: string }) => Promise<string>;
};

export type WorkflowTrigger = {
  matches: (ctx: WorkflowTriggerContext) => boolean;
};

export type WorkflowStepHandlers<
  TState extends z.ZodType,
  TStepName extends string,
> = Record<
  TStepName,
  (
    ctx: WorkflowStepContext<TState, TStepName>,
  ) => Promise<WorkflowStepResult<TState, TStepName>> | WorkflowStepResult<TState, TStepName>
>;

export type WorkflowDeclaration<
  TName extends string = string,
  TState extends z.ZodType = z.ZodType,
  TStepName extends string = string,
> = {
  readonly __workflowDeclaration: true;
  name: TName;
  description: string;
  specialist: string;
  version?: number;
  trigger: WorkflowTrigger;
  state: TState;
  initialState: z.input<TState> | z.output<TState>;
  prompt: WorkflowPrompt;
  tools: readonly string[];
  steps: WorkflowStepHandlers<TState, TStepName>;
  initialStep: TStepName;
};

export type InferWorkflowState<TWorkflow extends WorkflowDeclaration> = z.output<TWorkflow["state"]>;
export type InferWorkflowStepName<TWorkflow extends WorkflowDeclaration> = keyof TWorkflow["steps"] & string;

export function defineWorkflow<
  TName extends string,
  TState extends z.ZodType,
  TSteps extends Record<
    string,
    (
      ctx: WorkflowStepContext<TState, keyof TSteps & string>,
    ) => Promise<WorkflowStepResult<TState, keyof TSteps & string>> | WorkflowStepResult<TState, keyof TSteps & string>
  >,
>(workflow: Omit<
  WorkflowDeclaration<TName, TState, keyof TSteps & string>,
  "__workflowDeclaration"
>): WorkflowDeclaration<TName, TState, keyof TSteps & string> {
  return {
    __workflowDeclaration: true,
    ...workflow,
  };
}

export function isWorkflowDeclaration(value: unknown): value is WorkflowDeclaration {
  return typeof value === "object"
    && value !== null
    && "__workflowDeclaration" in value
    && (value as { __workflowDeclaration?: unknown }).__workflowDeclaration === true;
}
