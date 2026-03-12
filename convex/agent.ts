/**
 * Agent turn entry point.
 * This stays as the composition layer between prompt, tools, policy, and state.
 */
export async function runAgentTurn(runId: string): Promise<{ runId: string; status: string }> {
  return {
    runId,
    status: "not_implemented",
  };
}
