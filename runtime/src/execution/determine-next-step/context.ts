import type { ContextSection } from "../../context/sections.ts";
import type { Workflow } from "../../poc/workflow.ts";
import type { Thread } from "../../primitives/thread.ts";
import { ClarificationRequest, DoneForNow, type IntentDeclaration } from "./contract.ts";

export type DetermineNextStepContext = {
  sections: ContextSection[];
  contract: readonly IntentDeclaration[];
};

export async function buildWorkflowDetermineNextStepContext(
  workflow: Workflow,
): Promise<DetermineNextStepContext> {
  return {
    sections: await workflow.buildContextSections(),
    contract: workflow.contract,
  };
}

export function buildRoutingContext(
  availableWorkflows: Workflow[],
): DetermineNextStepContext {
  return {
    sections: [
      {
        title: "Available Workflows",
        body: availableWorkflows.map((workflow) =>
          `${workflow.intent.intent}: ${workflow.intent.description ?? workflow.name}`
        ).join("\n"),
      },
    ],
    contract: [
      ...availableWorkflows.map((workflow) => workflow.intent),
      ClarificationRequest,
      DoneForNow,
    ] as const,
  };
}

export async function loadWorkflowContext(
  thread: Thread,
  workflow: Workflow,
): Promise<void> {
  const context = await buildWorkflowDetermineNextStepContext(workflow);
  thread.determineNextStepSections = [...context.sections];
  thread.determineNextStepContract = context.contract;
  thread.determineNextStepSystemInstruction = "You are a helpful assistant that decides the next step.";
}

export function loadRoutingContext(
  thread: Thread,
  availableWorkflows: Workflow[],
): void {
  const context = buildRoutingContext(availableWorkflows);
  thread.determineNextStepSections = [...context.sections];
  thread.determineNextStepContract = context.contract;
  thread.determineNextStepSystemInstruction = "You are a chief of staff to a CEO. You are helping the CEO with their daily tasks. You are very good at understanding what the CEO wants and you are able to delegate tasks to the appropriate teams.";
}

export function loadContext(
  thread: Thread,
  context: DetermineNextStepContext,
): void {
  thread.determineNextStepSections = [...context.sections];
  thread.determineNextStepContract = context.contract;
}
