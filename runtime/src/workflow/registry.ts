import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorkflowManifest } from "./load.ts";
import type { WorkflowManifest } from "./load.ts";

export type { WorkflowManifest as Workflow } from "./load.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowsDir = path.resolve(__dirname, "../../../workflows");

export const pocWorkflows: WorkflowManifest[] = [
  loadWorkflowManifest(path.join(workflowsDir, "board-meeting-prep")),
];
