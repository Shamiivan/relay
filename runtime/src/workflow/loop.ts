import type { ModelAdapter } from "../../../packages/model/src/index.ts";
import { runExecutable } from "./execute.ts";
import { workflowContext } from "../step/context.ts";
import { determineNextStep } from "../step/determine.ts";
import type { Thread } from "../thread.ts";
import type { WorkflowManifest } from "./load.ts";

export async function runWorkflowLoop(args: {
  adapter: ModelAdapter;
  thread: Thread;
  workflow: WorkflowManifest;
  log?: (line: string) => void;
}): Promise<Thread> {
  const { adapter, thread, workflow, log } = args;
  const ctx = workflowContext(workflow);

  while (true) {
    log?.("");
    log?.("[workflow_planner.asking_for_next_step]");
    log?.("[system_instruction]");
    log?.(ctx.systemInstruction);

    const result = await determineNextStep({ adapter, thread, context: ctx });

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
        thread.append({ type: "model_response", data: result.nextStep.message });
        return thread;

      case "request_human_clarification":
        thread.append({ type: "request_human_clarification", data: { prompt: result.nextStep.prompt } });
        return thread;

      case "request_human_approval":
        thread.append({ type: "request_human_approval", data: { prompt: result.nextStep.prompt } });
        return thread;

      case "executable": {
        const manifest = workflow.executables.get(result.nextStep.executableName);
        if (!manifest) {
          throw new Error(`Unknown executable: ${result.nextStep.executableName}`);
        }

        thread.append({
          type: "executable_call",
          data: { executableName: result.nextStep.executableName, args: result.nextStep.args },
        });

        const executableResult = await runExecutable(manifest.dir, result.nextStep.args);

        thread.append({
          type: "executable_result",
          data: { executableName: result.nextStep.executableName, result: executableResult },
        });
        continue;
      }
    }
  }
}
