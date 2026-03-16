# Convex

Convex is Relay's durable state layer. The local worker performs execution, while Convex stores:

- `sessions`: conversation identity and continuity
- `sessionMessages`: user-visible conversation history only
- `runs`: one execution lifecycle per user request
- `runSteps`: coarse model/tool execution stages for one run
- `toolCalls`: one durable record per tool invocation
- `events`: append-only runtime audit events

This keeps human conversation separate from runtime state.
