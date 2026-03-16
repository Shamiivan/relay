# Runtime Primitives As Composable Units

## Goal

Make Relay's runtime model explicit around a small set of primitives that compose into larger behavior:

- `session`
- `run`
- `executionMode`
- `runStep`
- `toolCall`
- `event`

The design goal is not to make the runtime complex by itself. The goal is to make each primitive small, typed, and composable so more complex behavior can be assembled from them later without hiding the real execution model inside `runtime/src/worker.ts` and JSON blobs.

## Current Codebase Reading

The current implementation already behaves close to this model, but the names and storage shapes are still implicit.

- [`convex/runs.ts`](/home/shami/workspaces/relay/convex/runs.ts) already treats `run` as the durable unit of work for one user request.
- [`convex/schema.ts`](/home/shami/workspaces/relay/convex/schema.ts) stores human-visible history in `threadMessages` and runtime state in `runSteps`.
- [`runtime/src/worker.ts`](/home/shami/workspaces/relay/runtime/src/worker.ts) already has an execution loop with model turns, tool calls, completion, and failure.
- [`runtime/src/compile-step.ts`](/home/shami/workspaces/relay/runtime/src/compile-step.ts) reconstructs execution context by parsing `runSteps.outputJson` back into model messages.
- [`apps/tui/src/App.tsx`](/home/shami/workspaces/relay/apps/tui/src/App.tsx) inspects raw `runSteps` JSON, which is another sign that the runtime protocol exists but is not explicit enough yet.

In practice, Relay currently has these hidden primitives:

- `thread` is acting like a long-lived execution container
- `run` is one request execution
- `runStep(kind=model|tool)` is a coarse execution step
- `response.toolCalls[]` is an implicit tool-call record
- local trace file writes are an implicit event stream

That is the right direction. The plan is to make those records first-class and typed.

## Design Position

Treat these primitives as composable units, not as layers in a heavy runtime framework.

- `session` owns continuity
- `run` owns one request
- `executionMode` selects how that request is driven
- `runStep` captures durable execution stages
- `toolCall` captures each invocation cleanly
- `event` captures time-ordered trace facts

Complex behavior should come from composing these units together.

Examples:

- a simple one-shot assistant reply = one `session` + one `run(open_loop)` + one or more `runStep`s
- a later workflow execution = one `session` + one `run(workflow)` + many `runStep`s + many `toolCall`s + richer `event`s
- replay/debugging = `run` + `runStep` + `toolCall` + `event`

This keeps the primitives small and the combinations expressive.

## Target Primitive Definitions

### 1. `session`

`session` is the long-lived container for ongoing context and identity.

Responsibilities:

- owns participant identity and channel identity
- owns durable continuity across many runs
- is the container work belongs to
- may own session-scoped state later

Current mapping:

- today's `threads` table is effectively a `session`

Plan:

- introduce the name `session` in the architecture first
- either rename `threads` to `sessions`, or add a compatibility layer and migrate code incrementally

Recommendation:

- prefer renaming the primitive at the application layer first, because `thread` currently means "conversation container" rather than a UI thread abstraction

### 2. `run`

`run` is one durable execution request inside a session.

Responsibilities:

- one user request or one system-initiated request
- lifecycle state for execution
- terminal outcome
- final output

Current mapping:

- today's `runs` table already fits this well

Plan:

- keep `run` as the central durable unit of work
- make its request metadata more explicit instead of inferring behavior from worker code

### 3. `executionMode`

`executionMode` is an explicit field on each run.

Values:

- `open_loop`
- `workflow`

Responsibilities:

- tells the worker what kind of execution semantics apply
- makes runtime intent explicit in storage and in debugging
- avoids hiding execution policy in specialist config or branching worker logic

Current mapping:

- there is no explicit field today
- the worker always runs one implicit open-loop model/tool loop

Plan:

- add `executionMode` to `runs`
- default current bot-created runs to `open_loop`
- treat `workflow` as a reserved but real mode, even if initial behavior is minimal

Important:

- this does not mean introducing a workflow engine now
- it only makes the chosen execution mode explicit

### 4. `runStep`

`runStep` is a typed durable runtime record for a stage within a run.

Responsibilities:

- captures major execution stages
- records status and timing
- gives the worker a durable state machine that is easy to inspect

Current mapping:

- `runSteps` exists, but shape is too generic because `inputJson` and `outputJson` hide the real protocol

Plan:

- keep `runStep` as the coarse execution-stage record
- replace generic JSON envelopes with typed fields and narrower variants

Recommended step kinds:

- `model_request`
- `model_response`
- `tool_execution`
- `finalize`

Alternative if the team wants fewer rows:

- keep paired stages together as `model` and `tool`, but still give them typed fields instead of opaque JSON

Recommendation:

- stay coarse at first
- do not make `runStep` too granular if `toolCall` and `event` already cover fine-grained detail

### 5. `toolCall`

`toolCall` is one explicit tool invocation record.

Responsibilities:

- covers both machine tools and human tools
- one row per invocation
- input args
- normalized result, normalized failure, or pending response
- timing
- stable linkage back to `run` and optionally `runStep`

Current mapping:

- tool calls are only embedded inside model response JSON and tool step JSON in [`runtime/src/worker.ts`](/home/shami/workspaces/relay/runtime/src/worker.ts)

Plan:

- add a `toolCalls` table
- persist one record per invocation
- optionally keep `runStep(kind=tool_execution)` as the parent step for a batch, but do not make the batch JSON the only durable record

Tool categories:

- machine tools: `gmail.search`, `drive.getFile`
- human tools: `human.request_clarification`, `human.request_approval`

Important rule:

- human tools are still ordinary tool calls
- they should not introduce a separate primitive just because a person fulfills them
- the runtime difference is status progression, not type of abstraction

Suggested tool-call lifecycle:

- `queued`
- `running`
- `pending`
- `completed`
- `failed`
- `cancelled`

Interpretation:

- machine tools usually move from `running` to `completed` or `failed`
- human tools often move from `running` to `pending`, then later to `completed` or `cancelled`

Pattern reference:

- this matches the shape used in [`../ai-that-works/2025-06-03-humans-as-tools-async/src/agent.ts`](/home/shami/workspaces/ai-that-works/2025-06-03-humans-as-tools-async/src/agent.ts) and [`../ai-that-works/2025-06-03-humans-as-tools-async/src/cli.ts`](/home/shami/workspaces/ai-that-works/2025-06-03-humans-as-tools-async/src/cli.ts), where the agent emits a tool call first and only later receives a tool response from a human path

Why this matters:

- tool calls are one of the main composable units in the system
- if they stay embedded in blobs, composition and replay stay awkward
- human-in-the-loop behavior becomes a normal extension of the tool protocol instead of a side channel

### 6. `event`

`event` is the append-only trace layer for what happened over time.

Responsibilities:

- audit trail
- debugging trace
- replay assistance
- timing and observability

Current mapping:

- local trace files in [`runtime/src/worker.ts`](/home/shami/workspaces/relay/runtime/src/worker.ts) are functioning as an event stream
- `threadMessages` are only human-visible conversation history, not execution events

Plan:

- add an `events` table for time-ordered runtime facts
- keep `event` secondary to the main state tables
- do not make `event` the primary source of truth

Recommended event examples:

- `run.created`
- `run.claimed`
- `model.requested`
- `model.responded`
- `tool.called`
- `tool.completed`
- `run.completed`
- `run.failed`

## Composability Rules

The main architectural rule should be:

- state tables model stable facts needed by the product
- event tables model time-ordered trace facts

And:

- `session` composes many `run`s
- `run` composes many `runStep`s
- `runStep` composes many `toolCall`s when tools are involved
- `event` can be emitted for any of the above without replacing them

Waiting rule:

- a run can be `waitingOn: "human"` when it has one or more pending human `toolCall`s
- that waiting condition should be derived from explicit execution records, not hidden in ad hoc worker state

This gives a clean split:

- `session` and `run` are identity/lifecycle primitives
- `runStep` and `toolCall` are execution primitives
- `event` is the observability primitive

## Proposed Durable Model

### `sessions`

Either rename `threads` or introduce `sessions` with equivalent fields:

- `userId`
- `channelId`
- `specialistId`
- `activeRoutineId`
- `routineStateJson`
- `createdAt`
- `updatedAt`

Near-term rule:

- `session` replaces `thread` in architecture language

### `runs`

Extend current `runs` with:

- `sessionId` instead of `threadId` eventually
- `executionMode`
- optional `parentRunId` later if chaining becomes useful
- request metadata fields only if they correspond to real behavior

Suggested run shape additions:

- `executionMode: "open_loop" | "workflow"`
- `status: "todo" | "doing" | "done"`
- `outcome: "success" | "error" | "cancelled"`

### `runSteps`

Refactor from:

- `kind`
- `inputJson`
- `outputJson`

Toward explicit typed fields, for example:

- `kind`
- `status`
- `modelRequestJson`
- `modelResponseJson`
- `summaryText`
- `errorType`
- `errorMessage`
- `startedAt`
- `finishedAt`

If Convex unions stay awkward, a pragmatic alternative is:

- keep one JSON field for variant-specific payload
- add a required `kind`
- add a required `schemaVersion`
- add typed shared fields around it

That is still much better than the current fully generic envelope.

### `toolCalls`

New table:

- `runId`
- `runStepId`
- `sessionId`
- `index`
- `toolName`
- `toolKind`
- `argsJson`
- `status`
- `resultJson`
- `pendingRequestJson`
- `errorType`
- `errorMessage`
- `startedAt`
- `finishedAt`

Suggested values:

- `toolKind: "machine" | "human"`

Suggested status semantics:

- `pendingRequestJson` stores what is being asked of the human while the call is unresolved
- `resultJson` stores the human or machine response once the call is resolved
- human approval denial can be represented as either `completed` with a denial result or `cancelled`, but the repo should choose one convention and use it consistently

### `events`

New table:

- `sessionId`
- `runId`
- optional `runStepId`
- optional `toolCallId`
- `kind`
- `dataJson`
- `createdAt`

Keep the event schema intentionally narrow and append-only.

## Worker Refactor Direction

The worker should become explicit about which primitive it is manipulating at each moment.

Current problem in [`runtime/src/worker.ts`](/home/shami/workspaces/relay/runtime/src/worker.ts):

- compile model input
- write a `runStep`
- call model
- parse tool calls
- execute tools
- store batched tool output
- append local trace file

All of that works, but several different primitives are collapsed into one code path.

Target shape:

1. load `session`
2. load `run`
3. branch on `run.executionMode`
4. create `runStep(model_request)`
5. create `event(model.requested)`
6. complete model step with typed response fields
7. create one `toolCall` row per invocation
8. if a tool is human-facing, mark the `toolCall` as `pending`, set `run.waitingOn = "human"`, and stop active execution
9. when the human responds, complete that same `toolCall` and resume the run
10. emit `tool.called` and `tool.completed` events
11. create follow-up `runStep`s as needed
12. finalize run and append assistant-visible message

That makes the worker simpler because each write corresponds to a named primitive.

## Compile Path Refactor

[`runtime/src/compile-step.ts`](/home/shami/workspaces/relay/runtime/src/compile-step.ts) currently rebuilds model context by parsing generic `runSteps.outputJson`.

That should move toward:

- model replay from typed `runStep` records
- tool-result replay from `toolCall` records
- pending human interrupts from unresolved `toolCall` records

Recommendation:

- keep `threadMessages` for human-visible history only
- stop depending on generic `runStep.outputJson` as the runtime protocol
- build model replay from explicit execution records

This is one of the biggest wins because it removes hidden protocol coupling.

## UI / Inspection Impact

[`apps/tui/src/App.tsx`](/home/shami/workspaces/relay/apps/tui/src/App.tsx) currently exposes raw step JSON.

After the refactor, the TUI can become much clearer:

- queue pane: `session` + `run`
- details pane: `run` + `executionMode` + typed `runStep`s
- inspector pane: selected `runStep`, `toolCall`, or `event`
- pending approvals / clarifications should appear as unresolved `toolCall`s, not as a separate queue concept

This should be treated as a proof that the runtime model got simpler. If the TUI becomes easier to understand, the primitive split is probably correct.

## Recommended File Structure

Yes. The current repo is still readable, but the runtime concepts are spread across files by implementation detail rather than by primitive. That is why understanding one request requires jumping between Convex tables, worker control flow, compile logic, and transport code.

The file structure should make the primitive model obvious:

- `session` files together
- `run` files together
- `runStep` files together
- `toolCall` files together
- `event` files together
- runtime orchestration separate from persistence and transport

Recommended direction:

```text
convex/
  sessions.ts
  runs.ts
  runSteps.ts
  toolCalls.ts
  events.ts
  threadMessages.ts
  schema.ts

runtime/src/
  worker.ts
  execution/
    run-loop.ts
    open-loop.ts
    workflow-loop.ts
    finalize-run.ts
  compile/
    compile-run-input.ts
    replay-thread-messages.ts
    replay-run-steps.ts
    replay-tool-calls.ts
  tools/
    execute-tool-call.ts
    tool-registry.ts
    human-tools.ts
    machine-tools.ts
  tracing/
    emit-event.ts
    trace-file.ts
  domain/
    session.ts
    run.ts
    run-step.ts
    tool-call.ts
    event.ts
```

Why this is better:

- persistence stays in `convex/`
- execution flow stays in `runtime/src/execution/`
- replay/compilation logic stays in `runtime/src/compile/`
- tool execution concerns stay in `runtime/src/tools/`
- primitive names become visible in the directory tree

Pragmatic rule:

- do not create deep folder trees until a primitive has at least two or three files
- but once a concept like `toolCall` or `event` becomes real, give it a clear home immediately

## File Structure Rules

To keep the code easy to understand, use these rules:

- one primitive, one persistence file in `convex/`
- one runtime responsibility per file
- avoid files that mix compile logic, execution control, storage writes, and transport behavior
- prefer names that describe the runtime concept, not the implementation accident
- keep transport code thin: Discord should enqueue and deliver, not interpret runtime state
- keep replay code separate from execution code
- keep human-tool handling in the same tool-call path as machine tools

Good examples:

- `convex/toolCalls.ts` owns durable tool-call records
- `runtime/src/tools/execute-tool-call.ts` owns invocation behavior
- `runtime/src/compile/replay-tool-calls.ts` owns model replay from tool results

Bad examples:

- one large `worker.ts` that owns claiming, compiling, model execution, tool execution, event emission, and final delivery protocol details
- JSON parsing helpers in files whose real job is runtime orchestration

## Refactor Order For Structure

Do not move everything at once. The readable path is:

1. Add new primitive files first without deleting old ones.
2. Move worker helper logic into `runtime/src/execution/`, `compile/`, and `tools/`.
3. Introduce `convex/toolCalls.ts` and `convex/events.ts`.
4. Shrink `runtime/src/worker.ts` until it only claims runs and delegates.
5. Rename `threads` to `sessions` only after the runtime structure is already easier to follow.

Target end state for `worker.ts`:

- claim run
- load config
- dispatch to `run-loop`
- handle terminal success/failure

If `worker.ts` still reads like the entire architecture, the file structure is still doing too much.

## Migration Plan

### Phase 1. Make naming and mode explicit

- adopt `session` as the architectural term for today's `thread`
- add `executionMode` to `runs`
- default all existing entry points to `open_loop`
- update README and runtime docs to explain the primitive model

This phase is low-risk and gives immediate clarity.

### Phase 2. Extract `toolCall` as a first-class record

- add `toolCalls` table
- persist one row per tool invocation, including human tools
- keep existing `runSteps` working during migration
- update worker and TUI reads to consume `toolCalls`
- support `pending` tool calls that pause a run waiting on human input

This phase gives the highest leverage because tool invocation is currently the most important hidden primitive.

### Phase 3. Refactor `runStep` away from generic envelopes

- narrow `runStep.kind`
- add typed shared fields
- reduce dependence on `inputJson` and `outputJson`
- move replay logic off generic step JSON

This phase turns `runStep` into an actual runtime record instead of a blob carrier.

### Phase 4. Add `event` as the audit layer

- add durable `events`
- emit events from the worker for key lifecycle moments
- keep local trace file output optional or dev-only

This phase improves debugging and replay without making the event stream authoritative.

### Phase 5. Rename storage if still justified

- migrate `threads` to `sessions` if the naming mismatch keeps causing confusion
- otherwise keep storage name stable and use `session` as the domain term

This should be done only if the naming win is worth the migration cost.

## Non-Goals

- not building a general workflow engine
- not replacing the worker with a framework
- not making `event` the source of truth
- not redesigning business workflows
- not forcing an agent abstraction where a simpler execution abstraction is enough

## Recommended Implementation Order

1. Add `executionMode` to `runs`.
2. Introduce `session` language in docs and code comments.
3. Add `toolCalls` as one row per invocation.
4. Refactor compile/replay logic to read `toolCalls` directly.
5. Narrow `runStep` into typed execution stages.
6. Add durable `events`.
7. Re-evaluate whether `threads` should be renamed to `sessions`.

## Practical Decision Rules

- if a thing has lifecycle and needs querying, give it a table
- if a thing is only for trace/debug order, emit an event
- if a thing is part of replay semantics, do not hide it in opaque JSON
- if a thing is not a real behavior in the current system, do not add an abstraction for it yet

## Bottom Line

Relay already has the right runtime shape, but the primitives are blurred together.

The plan is to make the existing model explicit as a set of composable units:

- `session` for continuity
- `run` for one request
- `executionMode` for execution semantics
- `runStep` for durable stage records
- `toolCall` for invocation records
- `event` for audit and trace

That gives a runtime model that is easier to understand, easier to debug, and easier to extend, without turning Relay into a large orchestration system.
