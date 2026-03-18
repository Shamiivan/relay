import type { ContextSection } from "../context/sections.ts";
import type { IntentDeclaration } from "./contract.ts";
import type { WorkflowManifest } from "../workflow/load.ts";

export type StepContext = {
  sections: ContextSection[];
  contract: readonly IntentDeclaration[];
  systemInstruction: string;
};

export function workflowContext(workflow: WorkflowManifest): StepContext {
  return {
    sections: [...workflow.sections],
    contract: workflow.contract,
    systemInstruction: "You are a helpful assistant that decides the next step.",
  };
}
