import type { ConvexClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { emitRuntimeEvent } from "../tracing/emit-event";
import type { RunDoc } from "../primitives/run";

/**
 * Persists one coarse finalize run step so terminal state is visible in the inspector.
 */
export async function createFinalizeStep(
  convex: ConvexClient,
  run: RunDoc,
  summaryText: string,
  status: "completed" | "failed",
  errorMessage?: string,
): Promise<void> {
  const existingSteps = await convex.query(api.runSteps.listByRun, {
    runId: run._id,
  });
  const stepId = await convex.mutation(api.runSteps.create, {
    runId: run._id,
    sessionId: run.sessionId,
    index: existingSteps.length,
    kind: "finalize",
    summaryText,
  });

  if (status === "completed") {
    await convex.mutation(api.runSteps.complete, {
      stepId,
      summaryText,
    });
    return;
  }

  await convex.mutation(api.runSteps.fail, {
    stepId,
    errorType: "internal_error",
    errorMessage: errorMessage ?? summaryText,
  });
}

export async function finalizeSuccessfulRun(
  convex: ConvexClient,
  run: RunDoc,
  outputText: string,
): Promise<void> {
  await convex.mutation(api.sessionMessages.append, {
    sessionId: run.sessionId,
    runId: run._id,
    kind: "assistant_message",
    text: outputText,
  });
  await convex.mutation(api.runs.finish, {
    runId: run._id,
    outputText,
  });
  await createFinalizeStep(
    convex,
    run,
    "Run finalized with a successful assistant response.",
    "completed",
  );
  await emitRuntimeEvent(convex, {
    sessionId: run.sessionId,
    runId: run._id,
    kind: "run.output_recorded",
    data: { outputText },
  });
}

export async function finalizeFailedRun(
  convex: ConvexClient,
  run: RunDoc,
  errorType: string,
  errorMessage: string,
): Promise<void> {
  await convex.mutation(api.runs.fail, {
    runId: run._id,
    errorType,
    errorMessage,
  });
  await createFinalizeStep(
    convex,
    run,
    "Run finalized with an internal error.",
    "failed",
    errorMessage,
  );
}
