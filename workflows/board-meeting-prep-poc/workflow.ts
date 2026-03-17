import { ClarificationRequest, DoneForNow, defineIntent, field } from "../../runtime/src/execution/determine-next-step/contract.ts";
import { Workflow } from "../../runtime/src/poc/workflow.ts";
import { DeclaredToolAdapter } from "../../tools/sdk-class";
import { docsReadTool } from "../../tools/gworkspace/docs/docs.read/tool";
import { docsWriteTool } from "../../tools/gworkspace/docs/docs.write/tool";
import { driveCopyTool } from "../../tools/gworkspace/drive/drive.copy/tool";
import { driveSearchTool } from "../../tools/gworkspace/drive/drive.search/tool";
import { findReferenceDocTask } from "./tasks/find-reference-doc/task.ts";

export const boardMeetingPrepWorkflowIntent = defineIntent({
  name: "BoardMeetingPrepWorkflowPoc",
  intent: "board_meeting_prep_poc",
  description: "Prepare or revise board meeting documents using Google Drive and Docs and Calendar",
  fields: {},
});

const boardDriveSearchTool = new DeclaredToolAdapter({
  declaration: driveSearchTool,
  intent: defineIntent({
    name: "BoardMeetingDriveSearch",
    intent: "drive.search",
    description: "Search Google Drive for board-meeting-related folders and documents.",
    fields: {
      query: field.string("The Google Drive query to execute."),
      maxResults: field.number("Maximum files to return."),
    },
  }),
});

const boardDriveCopyTool = new DeclaredToolAdapter({
  declaration: driveCopyTool,
  intent: defineIntent({
    name: "BoardMeetingDriveCopy",
    intent: "drive.copy",
    description: "Copy the selected board-meeting reference document into the target folder.",
    fields: {
      fileId: field.string("The source Drive file id to copy."),
      name: field.string("The name for the copied file."),
      parentId: field.string("Optional destination folder id."),
    },
  }),
});

const boardDocsReadTool = new DeclaredToolAdapter({
  declaration: docsReadTool,
  intent: defineIntent({
    name: "BoardMeetingDocsRead",
    intent: "docs.read",
    description: "Read a specific Google Doc to inspect the board-meeting structure or content.",
    fields: {
      documentId: field.string("The Google Docs document id."),
    },
  }),
});

const boardDocsWriteTool = new DeclaredToolAdapter({
  declaration: docsWriteTool,
  intent: defineIntent({
    name: "BoardMeetingDocsWrite",
    intent: "docs.write",
    description: "Replace the working board-meeting Google Doc with the revised content.",
    fields: {
      documentId: field.string("The Google Docs document id."),
      text: field.string("The full replacement document body."),
    },
  }),
});

export const boardMeetingPrepWorkflowPoc = new Workflow({
  name: "board_meeting_prep_poc",
  intent: boardMeetingPrepWorkflowIntent,
  tasks: [findReferenceDocTask],
  tools: [
    boardDriveSearchTool,
    boardDriveCopyTool,
    boardDocsReadTool,
    boardDocsWriteTool,
  ],
  terminalIntents: [ClarificationRequest, DoneForNow],
  promptFiles: ["../board-meeting-prep/prompt.md"],
  moduleUrl: import.meta.url,
});
