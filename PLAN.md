# Relay — Digital Workspace Agent

> Note: Development is use-case-first. We are intentionally not building the full abstract system up front. The first vertical slice is: agent can access email. Architecture should stay minimal and only expand when a real use case forces it.

A composable workspace agent built on Unix philosophy and "Worse is Better".
Handles email, calendar, docs, campaigns — via Discord.

---

## Philosophy

**Worse is Better (New Jersey approach):**
- Implementation simplicity is #1
- Build the 50% solution that ships, not the perfect system
- Complexity emerges from combining tools, not internal machinery
- Each piece small enough to understand in one sitting

**Unix principles:**
- One thing well → narrow specialists, narrow adapters
- Composable → adapters usable standalone + as agent tools
- Separate policy from mechanism → LLM decides, deterministic policy executes
- Fail noisily → named errors, never regex parsing
- Silence is success → no output unless something needs attention

**Typing rule:**
- Strong typing by default
- Parse boundaries with Zod and keep internal/result shapes explicit
- Avoid `any`, implicit shapes, and `Record<string, unknown>` in core paths unless there is no stable schema yet

**No BAML.** Provider-agnostic model layer + Zod only.

**use jsdoc for documentation** important for the human to understand teh code

# Dev rules:
1. Clear Separation of Concerns
Each component type has ONE responsibility:
Primitives: Reusable components

2. Velocity Through Constraints
Architectural boundaries enable faster development by reducing decisions and preventing common mistakes.

3. Simplicity
the design must be simple, both in implementation and interface. It is more important for the implementation to be simple than the interface. Simplicity is the most important consideration in a design.

4. Correctness
the design must be correct in all observable aspects. It is slightly better to be simple than correct.

5. Consistency
the design must not be overly inconsistent. Consistency can be sacrificed for simplicity in some cases, but it is better to drop those parts of the design that deal with less common circumstances than to introduce either implementational complexity or inconsistency.

6. Completeness
the design must cover as many important situations as is practical. All reasonably expected cases should be covered. Completeness can be sacrificed in favor of any other quality. In fact, completeness must sacrificed whenever implementation simplicity is jeopardized. Consistency can be sacrificed to achieve completeness if simplicity is retained; especially worthless is consistency of interface.
7. use codegenration if it helps with keeping the code simple and consistent
for example convex has a good codegenration for types. you only define a method like this:

```

```
How to build effective agent runtime:
https://www.anthropic.com/engineering/building-effective-agents
https://mariozechner.at/posts/2025-11-30-pi-coding-agent/

  - Anthropic says the best systems use “simple, composable patterns” and recommend the simplest solu
    tion possible first: Building Effective AI Agents
    (https://www.anthropic.com/research/building-effective-agents)
  - Anthropic also says good context engineering means the “smallest possible set of high-signal toke
    ns”: Effective context engineering for AI agents
    (https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
  - OpenAI’s guide recommends maximizing a single agent carefully and warns about tool overload/compl
    exity management: A practical guide to building AI agents
    (https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)



a couple of agent runtime examples, we can copy the code from them;
/home/shami/workspaces/openclaw
/home/shami/workspaces/pi-mono
/home/shami/workspaces/langchain

---

## Future Direction

Keep Relay implementation-simple for now:

- `threads`
- `threadMessages`
- `runs`
- `runSteps`
- `specialists`

But the longer-term company model is likely workflow-first rather than agent-first.

- a company is better modeled as a set of workflows than a set of agents
- near-term keep Relay simple and avoid building a workflow engine early
- later consider making `workflow` the top-level business primitive

Likely future stack:

- `workflow` = business process
- `workflowRun` = one execution for a client/account
- `workflowStep` = business-level stage
- `specialist` = execution profile assigned to a step
- `runStep` = technical runtime execution record

Important distinction:

- `workflowStep` is business logic
- `runStep` is runtime logic

### Thread-Centered Runtime Direction

The execution model is easier to reason about when the runtime has one explicit
working object: `Thread`.

`Thread` should not be a new durable table. It should be a runtime projection
built from the existing durable records:

- `session` as the long-lived conversation anchor
- `run` as one execution attempt
- `sessionMessages` for visible user/assistant history
- `events` for append-only runtime history
- `toolCalls` for typed tool execution records
- `session.workflowStateJson` for active workflow state when present

Core idea:

- the thread is the context
- the loop extends the thread each turn
- the model decides the next step from the serialized thread plus allowed actions

This is closer to the simple BAML-style loop:

1. construct thread
2. serialize thread
3. determine next step
4. append tool call / result / human request / response
5. repeat

Design constraints:

- Convex remains the durable source of truth
- `Thread` lives in working memory and is reconstructed from persisted state
- trace files remain supplemental debugging artifacts, not the system of record
- tool choice is made by the LLM from an allowed set, not by the runtime

Implications for runtime design:

- `open_loop` and each workflow can construct their thread differently
- `open_loop` and each workflow can own their own run loop
- shared runtime should provide primitives, not a universal orchestration model

Shared runtime primitives should stay small:

- load thread
- append event
- list available tools
- determine next step
- run tool
- pause run
- finalize run

This keeps the authoring model simple:

- each workflow defines what belongs in its thread
- each workflow defines how that thread is serialized for the model
- each workflow defines how its loop reacts to the returned next step

This direction should improve:

- context legibility
- workflow authoring
- pause/resume clarity
- inspector design
- coding-agent ability to add new workflows and tools safely
