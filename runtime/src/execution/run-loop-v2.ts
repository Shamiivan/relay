import type { Thread, ThreadData } from "../primitives/thread";

export type NextStep =
  | { type: "done_for_now"; message: string }
  | { type: "request_human_clarification"; prompt: string }
  | { type: "request_human_approval"; prompt: string }
  | { type: "executable"; executableName: string; args: ThreadData };

export type RunLoopDeps = {
  determineNextStep: (thread: Thread) => Promise<NextStep>;
  runExecutable: (executableName: string, args: ThreadData) => Promise<ThreadData>;
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

      case "executable": {
        thread.append({
          type: "executable_call",
          data: {
            executableName: nextStep.executableName,
            args: nextStep.args,
          },
        });

        const result = await deps.runExecutable(nextStep.executableName, nextStep.args);

        thread.append({
          type: "executable_result",
          data: {
            executableName: nextStep.executableName,
            result,
          },
        });
        continue;
      }
    }
  }
}
