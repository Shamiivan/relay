# Convex

Convex is Relay's durable state layer. The local worker performs execution, while Convex stores:

- `threads`: conversation identity
- `threadMessages`: user-visible conversation history only
- `runs`: one execution lifecycle per user request
- `runSteps`: model/tool execution records for one run

This keeps human conversation separate from runtime state.
