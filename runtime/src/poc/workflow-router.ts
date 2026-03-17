import type { ModelAdapter } from "../../../packages/model/src/index.ts";
import { ClarificationRequest, DoneForNow } from "../execution/determine-next-step/contract.ts";
import { determineNextStepExplicit } from "../execution/determine-next-step/explicit.ts";
import type { Thread } from "../primitives/thread.ts";
import { getWorkflowByIntent } from "./workflow-registry.ts";
import type { Workflow } from "./workflow.ts";

export async function routeWorkflow(args: {
  adapter: ModelAdapter;
  thread: Thread;
  workflows: Workflow[];
  log?: (line: string) => void;
}): Promise<Workflow | Thread> {
  const contract = [
    ...args.workflows.map((workflow) => workflow.intent),
    ClarificationRequest,
    DoneForNow,
  ] as const;
  const workflowList = args.workflows.map((workflow) =>
    `${workflow.intent.intent}: ${workflow.intent.description ?? workflow.name}`
  ).join("\n");
  const systemInstruction = "You are a chief of staff to a CEO. You are helping the CEO with their daily tasks. You are very good at understanding what the CEO wants and you are able to delegate tasks to the appropriate teams.";
  args.log?.("");
  args.log?.("[workflow_router.asking_for_next_step]");
  args.log?.("[system_instruction]");
  args.log?.(systemInstruction);
  const result = await determineNextStepExplicit({
    adapter: args.adapter,
    thread: args.thread,
    contract,
    sections: [
      {
        title: "Available Workflows",
        body: workflowList,
      },
    ],
    systemInstruction,
  });
  args.log?.("");
  args.log?.("[workflow_router.got_next_step]");
  args.log?.("[prompt]");
  args.log?.(result.prompt);
  args.log?.("[raw_text]");
  args.log?.(result.rawText);
  args.log?.("[parsed]");
  args.log?.(JSON.stringify(result.parsed, null, 2));

  if (result.nextStep.type === "done_for_now") {
    args.thread.append({
      type: "model_response",
      data: result.nextStep.message,
    });
    return args.thread;
  }

  if (result.nextStep.type === "request_human_clarification") {
    args.thread.append({
      type: "request_human_clarification",
      data: { prompt: result.nextStep.prompt },
    });
    return args.thread;
  }

  if (result.nextStep.type === "request_human_approval") {
    args.thread.append({
      type: "request_human_approval",
      data: { prompt: result.nextStep.prompt },
    });
    return args.thread;
  }

  const nextStep = result.nextStep;

  args.thread.append({
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

  args.thread.append({
    type: "executable_result",
    data: {
      executableName: nextStep.executableName,
      result: {
        workflowName: workflow.name,
      },
    },
  });

  return workflow;
}
