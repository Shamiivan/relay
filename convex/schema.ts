/**
 * Minimal durable schema for early agent runs.
 * Expand only when a working use case requires more state.
 */
export const schema = {
  runs: {
    message: "string",
    userId: "string",
    status: "pending | running | paused | finished | failed",
    turnCount: "number",
  },
};
