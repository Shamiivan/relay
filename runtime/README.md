# Runtime

Runtime processes execute local agent work outside Convex. Keep the bot thin and let the worker own filesystem access and tool execution.

Current runtime shape:

- `compile/compile-run-input.ts` builds a compiled model request from prompt, static context, recent session messages, run steps, and tool-call results
- `compile/replay-session-messages.ts` projects visible session history only
- `execution/open-loop.ts` owns the current model/tool loop
- `execution/run-loop.ts` dispatches by `run.executionMode`
- `execution/finalize-run.ts` records terminal run state
- `tools/tool-registry.ts` and `tools/execute-tool-call.ts` separate tool lookup from invocation
- `tracing/emit-event.ts` and `tracing/trace-file.ts` keep runtime tracing separate from execution
- `routines/` contains plain-code request handlers that can intercept narrow, deterministic-ish tasks before the generic model loop
- `worker.ts` claims runs, loads config, and dispatches to the runtime loop

The runtime deliberately avoids using session history as execution state.
