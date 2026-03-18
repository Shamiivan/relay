import type { ModelAdapter } from "../../../packages/model/src/index.ts";
import { buildRoutingContext, loadContext } from "../execution/determine-next-step/context.ts";
import { determineNextStepExplicit } from "../execution/determine-next-step/explicit.ts";
import type { Thread } from "../primitives/thread.ts";
import { getWorkflowByIntent } from "./workflow-registry.ts";
import type { Workflow } from "./workflow.ts";

export type SelectedWorkflowResult =
  | { type: "done_for_now"; thread: Thread }
  | { type: "request_human_clarification"; thread: Thread }
  | { type: "request_human_approval"; thread: Thread }
  | { type: "workflow_selected"; thread: Thread; workflow: Workflow };

export async function selectWorkflow(
  args: {
    adapter: ModelAdapter;
    thread: Thread;
    availableWorkflows: Workflow[];
    log?: (line: string) => void;
  }): Promise<SelectedWorkflowResult> {

  const { adapter, thread, availableWorkflows, log } = args;

  const routingContext = buildRoutingContext(availableWorkflows);
  loadContext(thread, routingContext);
  const systemInstruction = "You are a chief of staff to a CEO. You are helping the CEO with their daily tasks. You are very good at understanding what the CEO wants and you are able to delegate tasks to the appropriate teams.";
  log?.("");
  log?.("[workflow_router.asking_for_next_step]");
  log?.("[system_instruction]");
  log?.(systemInstruction);
  const result = await determineNextStepExplicit({
    adapter,
    thread,
    systemInstruction,
  });
  log?.("");
  log?.("[workflow_router.got_next_step]");
  log?.("[prompt]");
  log?.(result.prompt);
  log?.("[raw_text]");
  log?.(result.rawText);
  log?.("[parsed]");
  log?.(JSON.stringify(result.parsed, null, 2));

  if (result.nextStep.type === "done_for_now") {
    thread.append({
      type: "model_response",
      data: result.nextStep.message,
    });
    return { type: "done_for_now", thread };
  }

  if (result.nextStep.type === "request_human_clarification") {
    thread.append({
      type: "request_human_clarification",
      data: { prompt: result.nextStep.prompt },
    });
    return { type: "request_human_clarification", thread };
  }

  if (result.nextStep.type === "request_human_approval") {
    thread.append({
      type: "request_human_approval",
      data: { prompt: result.nextStep.prompt },
    });
    return { type: "request_human_approval", thread };
  }

  const nextStep = result.nextStep;

  thread.append({
    type: "executable_call",
    data: {
      executableName: nextStep.executableName,
      args: nextStep.args,
    },
  });

  const workflow = getWorkflowByIntent(nextStep.executableName);
  if (!workflow) {
    throw new Error(`Unknown workflow selected: ${nextStep.executableName}`);
  }

  thread.append({
    type: "executable_result",
    data: {
      executableName: nextStep.executableName,
      result: {
        workflowName: workflow.name,
      },
    },
  });

  return { type: "workflow_selected", thread, workflow };
}
