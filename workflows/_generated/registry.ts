import { boardMeetingPrepWorkflow } from "../board-meeting-prep/workflow";

export const workflowRegistry = {
  "board_meeting_prep": boardMeetingPrepWorkflow,
} as const;

export const workflowPrompts = {
  "board_meeting_prep": "You are running the board meeting preparation workflow.\n\nUse Drive and Docs tools directly when the workflow step requires them.\n\nRules:\n- Prefer the most recent strong board-related document as the reference when no explicit user preference is given.\n- Keep concrete metadata attached to files: file name, mime type, modified time, and Drive link when available.\n- When revising the working document, preserve the structure and tone of the current document unless the user explicitly asks for a structural change.\n- Return plain text only from any generation step.",
} as const satisfies Record<keyof typeof workflowRegistry, string>;

export const workflowNames = Object.freeze(
  Object.keys(workflowRegistry),
) as readonly (keyof typeof workflowRegistry)[];

export type WorkflowName = keyof typeof workflowRegistry;

export function getWorkflow(name: string) {
  return workflowRegistry[name as WorkflowName];
}

export function getWorkflowPrompt(name: string): string {
  return workflowPrompts[name as WorkflowName] ?? "";
}
