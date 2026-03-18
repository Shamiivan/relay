import type { ModelAdapter } from "../../../packages/model/src/index.ts";
import { loadWorkflowContext } from "../execution/determine-next-step/context.ts";
import { determineNextStep } from "../execution/determine-next-step/determine.ts";
import type { Thread } from "../primitives/thread.ts";
import type { Workflow } from "./workflow.ts";

export async function runWorkflowLoop(args: {
  adapter: ModelAdapter;
  thread: Thread;
  workflow: Workflow;
  log?: (line: string) => void;
}): Promise<Thread> {
  const { adapter, thread, workflow, log } = args;
  await loadWorkflowContext(thread, workflow);

  while (true) {
    log?.("");
    log?.("[workflow_planner.asking_for_next_step]");
    log?.("[system_instruction]");
    log?.(thread.determineNextStepSystemInstruction);

    const result = await determineNextStep({
      adapter,
      thread,
    });

    log?.("");
    log?.("[workflow_planner.got_next_step]");
    log?.("[prompt]");
    log?.(result.prompt);
    log?.("[raw_text]");
    log?.(result.rawText);
    log?.("[parsed]");
    log?.(JSON.stringify(result.parsed, null, 2));

    switch (result.nextStep.type) {
      case "done_for_now":
        thread.append({
          type: "model_response",
          data: result.nextStep.message,
        });
        return thread;

      case "request_human_clarification":
        thread.append({
          type: "request_human_clarification",
          data: { prompt: result.nextStep.prompt },
        });
        return thread;

      case "request_human_approval":
        thread.append({
          type: "request_human_approval",
          data: { prompt: result.nextStep.prompt },
        });
        return thread;

      case "executable": {
        thread.append({
          type: "executable_call",
          data: {
            executableName: result.nextStep.executableName,
            args: result.nextStep.args,
          },
        });

        const executableResult = await workflow.runExecutable(
          result.nextStep.executableName,
          result.nextStep.args,
        );

        thread.append({
          type: "executable_result",
          data: {
            executableName: result.nextStep.executableName,
            result: executableResult,
          },
        });
        continue;
      }
    }
  }
}
