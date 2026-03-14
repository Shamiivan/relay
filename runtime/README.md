# Runtime

Runtime processes execute local agent work outside Convex. Keep the bot thin and let the worker own filesystem access and tool execution.

Current runtime shape:

- `compile-step.ts` builds a `CompiledStep` from prompt, static context, recent thread messages, and current run steps
- `worker.ts` orchestrates the loop: compile step, call model adapter, execute tools, persist run steps
- `thread.ts` only projects visible thread history

The runtime deliberately avoids using thread history as execution state.
