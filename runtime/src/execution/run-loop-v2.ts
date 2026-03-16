import type { Thread, ThreadData } from "../primitives/thread";

export type NextStep =
  | { type: "done_for_now"; message: string }
  | { type: "request_human_clarification"; prompt: string }
  | { type: "request_human_approval"; prompt: string }
  | { type: "tool"; toolName: string; args: ThreadData };

export type RunLoopDeps = {
  determineNextStep: (thread: Thread) => Promise<NextStep>;
  runTool: (toolName: string, args: ThreadData) => Promise<ThreadData>;
};

/**
 * Minimal thread-centered loop:
 * serialize thread -> determine next step -> append result -> continue or stop.
 */
export async function runLoop(
  thread: Thread,
  deps: RunLoopDeps,
): Promise<Thread> {
  while (true) {
    const nextStep = await deps.determineNextStep(thread);

    switch (nextStep.type) {
      case "done_for_now":
        thread.append({
          type: "model_response",
          data: nextStep.message,
        });
        return thread;

      case "request_human_clarification":
        thread.append({
          type: "request_human_clarification",
          data: { prompt: nextStep.prompt },
        });
        return thread;

      case "request_human_approval":
        thread.append({
          type: "request_human_approval",
          data: { prompt: nextStep.prompt },
        });
        return thread;

      case "tool": {
        thread.append({
          type: "tool_call",
          data: {
            toolName: nextStep.toolName,
            args: nextStep.args,
          },
        });

        const result = await deps.runTool(nextStep.toolName, nextStep.args);

        thread.append({
          type: "tool_result",
          data: {
            toolName: nextStep.toolName,
            result,
          },
        });
        continue;
      }
    }
  }
}
