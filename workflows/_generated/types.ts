import type { InferWorkflowState, InferWorkflowStepName } from "../sdk";
import { workflowNames } from "./registry";
import { boardMeetingPrepWorkflow } from "../board-meeting-prep/workflow";

export type WorkflowName = (typeof workflowNames)[number];
export type BoardMeetingPrepWorkflowState = InferWorkflowState<typeof boardMeetingPrepWorkflow>;
export type BoardMeetingPrepWorkflowStepName = InferWorkflowStepName<typeof boardMeetingPrepWorkflow>;
