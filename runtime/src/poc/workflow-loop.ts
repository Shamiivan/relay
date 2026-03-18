import type { ModelAdapter } from "../../../packages/model/src/index.ts";
import { buildWorkflowDetermineNextStepContext, loadContext } from "../execution/determine-next-step/context.ts";
import { buildExplicitDetermineNextStepSchema, determineNextStepExplicit } from "../execution/determine-next-step/explicit.ts";
import type { Thread } from "../primitives/thread.ts";
import type { Workflow } from "./workflow.ts";

export async function runWorkflowLoop(args: {
  adapter: ModelAdapter;
  thread: Thread;
  workflow: Workflow;
  log?: (line: string) => void;
}): Promise<Thread> {
  const context = await buildWorkflowDetermineNextStepContext(args.workflow);
  loadContext(args.thread, context);
  const contextSchema = buildExplicitDetermineNextStepSchema(context.contract);
  const systemInstruction = "You are a helpful assistant that decides the next step.";

  while (true) {
    args.log?.("");
    args.log?.("[workflow_planner.asking_for_next_step]");
    args.log?.("[system_instruction]");
    args.log?.(systemInstruction);

    const result = await determineNextStepExplicit({
      adapter: args.adapter,
      thread: args.thread,
      systemInstruction,
    });

    args.log?.("");
    args.log?.("[workflow_planner.got_next_step]");
    args.log?.("[prompt]");
    args.log?.(result.prompt);
    args.log?.("[raw_text]");
    args.log?.(result.rawText);
    args.log?.("[parsed]");
    args.log?.(JSON.stringify(result.parsed, null, 2));
    contextSchema.parse(result.parsed);

    switch (result.nextStep.type) {
      case "done_for_now":
        args.thread.append({
          type: "model_response",
          data: result.nextStep.message,
        });
        return args.thread;

      case "request_human_clarification":
        args.thread.append({
          type: "request_human_clarification",
          data: { prompt: result.nextStep.prompt },
        });
        return args.thread;

      case "request_human_approval":
        args.thread.append({
          type: "request_human_approval",
          data: { prompt: result.nextStep.prompt },
        });
        return args.thread;

      case "executable": {
        args.thread.append({
          type: "executable_call",
          data: {
            executableName: result.nextStep.executableName,
            args: result.nextStep.args,
          },
        });

        const executableResult = await args.workflow.runExecutable(
          result.nextStep.executableName,
          result.nextStep.args,
        );

        args.thread.append({
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
