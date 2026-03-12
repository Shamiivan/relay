/**
 * Run lifecycle helpers for the agent loop.
 * Keep the first version small and easy to replace with real Convex code.
 */
export type RunStatus = "pending" | "running" | "paused" | "finished" | "failed";

export type RunRecord = {
  id: string;
  message: string;
  userId: string;
  status: RunStatus;
  turnCount: number;
};

export async function createRun(message: string, userId: string): Promise<RunRecord> {
  return {
    id: crypto.randomUUID(),
    message,
    userId,
    status: "pending",
    turnCount: 0,
  };
}

export async function finishRun(run: RunRecord): Promise<RunRecord> {
  return { ...run, status: "finished" };
}
