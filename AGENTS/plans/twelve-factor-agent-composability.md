# Twelve-Factor Agent Composability

## Goal

Describe the architecture Relay is moving toward, inspired by:

- `/home/shami/workspaces/ai-that-works/2025-04-22-twelve-factor-agents/step-by-step`

This document is not about naming layers.
It is about the loose requirements the system should satisfy.

The point is to preserve the strong properties of the reference project while still allowing Relay to compose:

- prompts
- tools
- tasks
- workflows
- runtime state

---

## What Matters In The Reference

The important part of the reference is not:

- BAML
- calculator examples
- a specific CLI
- a specific prompt wording

The important part is the execution model:

- the system owns the loop
- the model chooses the next step from a bounded surface
- the system records what happened
- the system can pause and resume
- humans can be part of the same loop

That is the part Relay should preserve.

---

## Core Requirements

If Relay is going to be "inspired by the step-by-step twelve-factor agent", these requirements should hold.

### 1. The system owns control flow

The model does not run the program.
The runtime does.

The model proposes the next step.
The runtime decides what to execute, what to record, when to stop, and when to resume.

This is the main property to preserve.

### 2. The next-step surface is bounded

At any point, the model should only be able to choose from a declared set of next actions.

Examples:

- terminal actions like `done_for_now`
- a request for clarification
- a workflow task
- a declared tool call

The model should not invent new actions outside that surface.

### 3. Execution history is explicit

The system should record:

- what the model selected
- what tool or task executed
- what result came back
- what is now pending

This history is not just for debugging.
It is part of how the system remains predictable.

### 4. Pause and resume are real

The system should be able to stop in the middle of work and continue later without relying on hidden model memory.

Examples:

- waiting for a human answer
- waiting for approval
- waiting for an external system

This should come from persisted state, not prompt tricks.

### 5. Humans fit the same execution model

If the agent needs clarification or approval, that should not break the architecture.

It should still look like:

- choose next step
- record it
- pause if needed
- resume when the missing input arrives

The exact representation can vary, but the lifecycle should stay explicit.

### 6. Prompts are composable, not monolithic

Relay should not depend on one giant system prompt that carries all workflow logic.

Prompt construction should be assembled from small pieces such as:

- stable system doctrine
- workflow instructions
- task or tool instructions
- current thread or event history
- structured next-step contract

This is what keeps the system composable.

### 7. Workflow boundaries are explicit

A workflow should declare its bounded surface clearly.

That means it should reveal:

- what actions are allowed next
- what state matters
- what instructions apply

A workflow is useful because it constrains the planner and keeps the execution surface inspectable.

---

## Design Position

Relay should not try to "put the twelve-factor agent into the prompt".

That framing is too prompt-centric.

What Relay should do instead is preserve the twelve-factor properties across the whole architecture:

- prompt construction
- workflow declaration
- runtime execution
- persistence

The prompt should help choose the next step.
It should not be the only place where the system's behavior is defined.

---

## What Should Be True Of The Architecture

### The model is a selector

The model's job is:

- look at the current context
- choose the best next declared action

Its job is not:

- define control flow
- remember hidden state
- enforce legality
- enforce resumability

### The runtime is the source of truth for execution

The runtime should own:

- execution sequencing
- dispatch
- recording
- stop conditions
- pause and resume

This is the part that gives the system real behavior.

### The context builder is explicit

The system should explicitly build the model-facing context from:

- history
- current state
- prompt fragments
- allowed next-step contract

That builder should be inspectable and predictable.

It should not be hidden inside one thread object or one long prompt file.

### The workflow surface is explicit

A workflow exists to make the system's allowed behavior visible.

It should bound:

- tasks
- tools
- terminal actions
- workflow-specific instructions

Without that boundary, the planner surface becomes mushy again.

---

## Practical Implications

### What not to do

- do not solve this by pasting a long "be a twelve-factor agent" block into the system prompt
- do not hide runtime state only in natural language history
- do not let the model invent undeclared actions
- do not make pause and resume depend on the model remembering what happened

### What to do

- make next-step choices explicit and typed
- record chosen steps and results durably
- assemble prompts from small declared parts
- make workflow boundaries visible
- treat waiting states as real runtime states

---

## Loose Architecture Sketch

This is the shape the system should have, without overcommitting to names.

### A persisted execution history

There should be a durable record of:

- user-visible conversation
- execution facts
- pending work

The exact storage tables can evolve.
The key requirement is that the system can reconstruct what is going on.

### A planner contract

For any turn, the system should be able to say:

- here is the context
- here are the allowed next actions
- choose one

That contract is one of the main places where predictability comes from.

### A dispatcher

Once a next step is chosen, the system should route it to the correct executable:

- tool
- task
- human wait state
- terminal response

### A resumable state model

When execution stops temporarily, the system should know enough to continue later.

That means some combination of:

- current workflow identity
- current step
- current state snapshot
- pending request or approval

### A composable prompt builder

Prompt construction should be built from declared pieces rather than handwritten per-flow blobs.

This lets workflows differ without forcing the whole system to fork.

---

## Migration Guidance

The safest path is incremental.

### First

Make the planner contract explicit.

Goal:

- the system can clearly describe the allowed next actions for a turn

### Second

Make execution facts explicit and durable.

Goal:

- the system can pause, resume, replay, and inspect decisions cleanly

### Third

Make workflows declare their bounded surfaces.

Goal:

- composition happens through declarations instead of through prompt sprawl

### Fourth

Shrink prompts as more behavior becomes structural.

Goal:

- the model selects within a clear system instead of carrying system behavior in prose

---

## Open Questions

- Should human clarification be represented as a terminal action, a human tool call, or both depending on context?
- Where should resumable workflow state live so it is durable without being awkward?
- How much of the current coding-agent planner surface should be narrowed by workflow declarations?
- Should tasks and tools share one executable interface or remain distinct but parallel?
- How small can the global doctrine prompt become once workflows and runtime contracts are explicit?

---

## Bottom Line

The architecture is about preserving a few strong properties:

- explicit next-step selection
- explicit execution history
- explicit pause and resume
- explicit workflow boundaries
- composable prompt construction

That is the real value to carry over from the twelve-factor reference.

The point is not to copy its CLI or copy its prompt style.
The point is to keep the system inspectable, bounded, and resumable while still letting Relay compose new behavior cleanly.
