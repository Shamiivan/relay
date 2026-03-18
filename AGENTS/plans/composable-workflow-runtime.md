# Composable Workflow Runtime

## Goal

Move Relay toward a runtime where the main units are explicit, composable declarations:

- `Tool` for external capabilities
- `Task` for internal workflow nodes
- `Workflow` for bounded composition
- `Thread` for active reasoning state
- `runLoop` for orchestration only

The main design goal is composition:

- one place to declare a tool
- one place to declare a task
- one place to declare a workflow surface
- one context builder
- one generic loop

Reference inspiration:

- `/home/shami/workspaces/ai-that-works/2025-04-22-twelve-factor-agents/step-by-step`

When applying this architecture, inspect the current Relay codebase first and map the design onto what already exists instead of assuming a greenfield rewrite.

---

## Core Ideas

### Tools And Tasks Are First-Class Executables

Both `Tool` and `Task` are declarative executable units.

They both own:

- intent declaration
- input schema
- output schema
- prompt markdown
- execution logic

They differ in meaning:

- `Tool` reaches into an external system
- `Task` advances local workflow logic

They are sibling concepts, not the same concept.
But they can be composed into the same workflow surface.

---

### Workflow Reveals The Bounded Surface

A workflow should explicitly reveal what the planner is allowed to do next.

That surface is:

- terminal intents such as `request_more_information` and `done_for_now`
- workflow tasks
- workflow tools

The workflow is the main composition boundary.
It determines:

- available executables
- available prompt sections
- available planner contract

This is the main reason workflows exist.

---

### Planner Context Is Built Explicitly

`Thread` is the active reasoning state object.

It owns:

- event history
- current in-memory state
- serialization of thread history

It should not be used as a bag for planner-only configuration such as:

- determine-next-step contract
- prompt sections
- planner schema
- system instruction

A separate builder should create the model-facing planner context from:

- thread events
- workflow prompt
- task prompt sections
- tool prompt sections
- workflow contract

Recommended shape:

- `buildDetermineNextStepContext({ thread, workflow })`
- `buildDetermineNextStepRequest(context)`

This keeps the construction explicit and inspectable while avoiding hidden mutation on `Thread`.
Prompt construction should live in the planner/context builder layer, not in the loop.

---

### Run Loop Only Orchestrates

`runLoop` should remain a runtime primitive.

It should:

1. ask a context builder for planner context
2. ask the planner for the next step
3. dispatch the selected executable
4. append events
5. continue or stop

It should not own:

- workflow declaration
- context assembly
- task logic
- tool logic

---

## Primitive Roles

### Tool

External executable.

Owns:

- `intent`
- `input`
- `output`
- `promptFiles`
- `run()`

Examples:

- `drive.search`
- `docs.read`
- `gmail.search`

### Task

Internal workflow executable.

Owns:

- `intent`
- `input`
- `output`
- `promptFiles`
- `run()`

Examples:

- `find_reference_doc`
- `select_reference_doc`
- `prepare_revision_plan`

### Workflow

Composition unit.

Owns:

- `tasks`
- `tools`
- `terminalIntents`
- `promptFiles`

Derives:

- `contract`
- `executables`
- prompt sections

### Thread

Reasoning state.

Owns:

- events
- serialization
- no planner-only config

### runLoop

Generic orchestrator.

Owns:

- next-step execution cycle
- event append behavior
- stop/continue semantics

---

## Composition Rules

### Explicit

These should be declared explicitly:

- workflow `tools`
- workflow `tasks`
- workflow `terminalIntents`
- workflow prompt files

### Derived

These should be derived:

- workflow `contract`
- executable dispatch table
- rendered prompt sections

This gives explicit workflow surfaces without needless duplication.

---

## Architectural Principles

### Runtime Validation Over Type Cleverness

Bias toward:

- readable declarations
- explicit composition
- Zod validation at runtime

Avoid:

- unreadable mapped types
- clever type-level plumbing that hides the real architecture

### Session Is Not Core To The Inner Model

`Session` is not required for the core architecture.

The core runtime model is:

- `Tool`
- `Task`
- `Workflow`
- `Thread`
- `runLoop`

If `Session` exists later, it should be a durable container outside the inner loop.

### Codegen Is Not The Core Idea

The design should work through explicit composition first.

Codegen should not define the architecture.
If it exists later, it should support the model, not shape it.

### Legacy Tools Can Be Bridged

Existing `defineTool(...)` tools should not block the new architecture.

They can be adapted temporarily while the core model is validated.

---

## Summary

The target architecture is a composable runtime where:

- `Tool` acts externally
- `Task` acts internally
- `Workflow` reveals the bounded surface
- `Thread` builds context
- `runLoop` orchestrates

The main idea is explicit composition, not hidden registration or scattered runtime plumbing.
