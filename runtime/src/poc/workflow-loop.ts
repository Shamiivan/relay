import type { ModelAdapter } from "../../../packages/model/src/index.ts";
import { buildExplicitDetermineNextStepSchema, determineNextStepExplicit } from "../execution/determine-next-step/explicit.ts";
import { runLoop } from "../execution/run-loop-v2.ts";
import type { Thread } from "../primitives/thread.ts";
import type { Workflow } from "./workflow.ts";

export async function workflowLoop(args: {
  adapter: ModelAdapter;
  thread: Thread;
  workflow: Workflow;
  log?: (line: string) => void;
}): Promise<Thread> {
  const contextSchema = buildExplicitDetermineNextStepSchema(args.workflow.contract);
  const systemInstruction = "You are a helpful assistant that decides the next step.";

  return await runLoop(args.thread, {
    determineNextStep: async (currentThread) => {
      const context = await currentThread.buildContext({ workflow: args.workflow });
      args.log?.("");
      args.log?.("[workflow_planner.asking_for_next_step]");
      args.log?.("[system_instruction]");
      args.log?.(systemInstruction);
      const result = await determineNextStepExplicit({
        adapter: args.adapter,
        prompt: context.prompt,
        contract: context.contract,
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
      return result.nextStep;
    },
    runExecutable: async (executableName, executableArgs) =>
      await args.workflow.runExecutable(executableName, executableArgs),
  });
}
