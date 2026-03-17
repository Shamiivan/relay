import { boardMeetingPrepWorkflowPoc } from "../../../workflows/board-meeting-prep-poc/workflow.ts";
import type { Workflow } from "./workflow.ts";

export const pocWorkflows: Workflow[] = [
  boardMeetingPrepWorkflowPoc,
];

export function getWorkflowByIntent(intentName: string): Workflow | undefined {
  return pocWorkflows.find((workflow) => workflow.intent.intent === intentName);
}
