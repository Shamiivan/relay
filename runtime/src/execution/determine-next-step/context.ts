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

export function loadContext(
  thread: Thread,
  context: DetermineNextStepContext,
): void {
  thread.determineNextStepSections = [...context.sections];
  thread.determineNextStepContract = context.contract;
}
