# Feature Request: Resumable Workflow Memory

**Date:** 2026-03-25
**Status:** draft

---

## What

Add resumable workflow memory to Relay so a user can pause a workflow, return in
a later session, and resume from the right checkpoint with the right facts and
artifacts.

The goal is not generic long-term memory. The goal is durable, selective resume
for real operational workflows, starting with
[`company/workflows/email_campaign/`](/home/shami/workspaces/relay/company/workflows/email_campaign).

---

## Why

Today Relay has a useful in-process thread and an explicit workflow loop, but it
does not yet have a durable workflow context that survives beyond a single run.

That creates a product gap:

- if a campaign pauses for approval, the user has to reconstruct context later
- approved decisions and pending next steps are not first-class runtime state
- raw transcript risks becoming the accidental memory layer
- there is no clean way to resume while selectively ignoring rejected or stale
  work

This conflicts with the direction in [`PLAN.md`](/home/shami/workspaces/relay/PLAN.md):

- pause and resume should work through simple APIs
- the runtime should own state
- the model should operate as a stateless reducer over compiled context
- transcript should not be treated as memory

---

## User story

```txt
As an operator running campaign workflows through Relay
I want the agent to pause and resume work across sessions
So it remembers approved facts and unfinished steps from the last session
without forcing me to repeat context, while still letting me ignore stale or
rejected work
```

---

## Concrete scenario

I start an email campaign workflow for a company.

Relay researches the account, proposes an ICP, drafts copy, and pauses for my
approval before it creates or updates the campaign.

When I come back later, I want to resume that same workflow context and have
Relay remember:

- which company and campaign we were working on
- what research was already gathered
- which offer and copy were approved
- what was rejected
- what the next pending action is

I also want to selectively ignore parts of prior work, such as stale drafts,
rejected positioning, or unrelated past campaign sessions.

---

## Current problem

Relay currently has:

- an in-memory event thread in
  [`runtime/src/thread.ts`](/home/shami/workspaces/relay/runtime/src/thread.ts)
- a runtime-owned workflow loop in
  [`runtime/src/workflow/loop.ts`](/home/shami/workspaces/relay/runtime/src/workflow/loop.ts)
- explicit workflow manifests in
  [`runtime/src/workflow/load.ts`](/home/shami/workspaces/relay/runtime/src/workflow/load.ts)

What it does not have is:

- a durable workflow context ID
- a checkpointed open workflow state
- durable campaign-scoped artifacts as first-class resume inputs
- a memory policy for include/exclude behavior on resume

Without those pieces, pause/resume is fragile and transcript replay becomes the
default fallback.

---

## Proposal

Introduce three layers of workflow memory:

```txt
RunHandle
  private attachment for one invocation
  - workflowId
  - contextId
  - mode: fresh | resume | fork
  - memoryPolicy

OpenContext
  shared resumable workflow state
  - checkpoint
  - summary
  - pending approvals
  - pending actions
  - linked artifact IDs

Artifact
  durable campaign/workflow outputs
  - approved facts
  - decisions
  - research
  - offer drafts/finals
  - external tool IDs
```

The runtime should compile the model context from `OpenContext + Artifact +
workflow context`, not from raw transcript alone.

---

## Design rules

1. Transcript is audit, not memory.
   Resume behavior must not depend on replaying the full conversation.

2. Start narrow.
   The first full slice should target the email campaign workflow, not all
   possible workflows.

3. Keep memory structured.
   Facts, decisions, drafts, and artifacts should be tagged and queryable.

4. Support pause, resume, and fork.
   Resume continues shared context. Fork creates a new branch from an existing
   context.

5. Keep the model stateless.
   The runtime owns persistence, compilation, and checkpointing.

6. Support selective ignore.
   Rejected, superseded, or irrelevant items must be excludable by policy.

---

## Scope

### In

| # | What |
|---|---|
| 1 | Durable `contextId` for a workflow run |
| 2 | Persisted `OpenContext` with checkpoint, summary, and pending actions |
| 3 | Durable campaign/workflow artifacts used during resume |
| 4 | Resume API or command that restores a paused context |
| 5 | Memory policy for excluding rejected or superseded items |
| 6 | Initial implementation for `company/workflows/email_campaign/` |

### Out

| # | What |
|---|---|
| 1 | Global semantic memory across every workflow |
| 2 | Fully autonomous recovery from all invalid states |
| 3 | Cross-company knowledge retrieval on day one |
| 4 | A giant general-purpose memory subsystem before the first use case ships |

---

## Acceptance criteria

1. A workflow can be paused with a durable `contextId`.
2. A paused workflow can be resumed later from that `contextId`.
3. Resume restores the active checkpoint, summary, pending approvals, and
   pending actions.
4. Approved facts and artifacts from the prior session are included in the next
   run's compiled context.
5. Rejected or superseded items can be excluded by memory policy.
6. Raw transcript is not required for correct resume behavior.
7. The same workflow context can be resumed from multiple entrypoints.
8. The agent can fork a previous context into a new branch without mutating the
   original.

---

## Implementation direction

### 1. Durable types

Add explicit runtime types for:

- `RunHandle`
- `OpenContext`
- `Artifact`
- `MemoryPolicy`

### 2. Repository layer

Pick a first storage backend and hide it behind a small repository API.

Suggested operations:

- `createContext(workflow, scope) -> contextId`
- `getContext(contextId) -> OpenContext`
- `checkpointContext(contextId, checkpoint)`
- `appendEvent(contextId, event)`
- `listArtifacts(contextId, filters)`
- `resumeContext(contextId, memoryPolicy) -> RunHandle`
- `forkContext(contextId) -> newContextId`

### 3. Context compiler

Build a compiler that produces the model-facing context from:

- workflow README/context sections
- current `OpenContext`
- selected `Artifact` records
- compacted summaries and pending actions

### 4. Workflow integration

Apply the first vertical slice to
[`company/workflows/email_campaign/`](/home/shami/workspaces/relay/company/workflows/email_campaign)
so campaign work can pause and resume safely.

---

## Related

- [`PLAN.md`](/home/shami/workspaces/relay/PLAN.md) — architectural direction
- [`USER_STORY.md`](/home/shami/workspaces/relay/USER_STORY.md) — original story draft
- [`AGENTS/feature_requests/2026-03-20-email-campaign-task-runner.md`](/home/shami/workspaces/relay/AGENTS/feature_requests/2026-03-20-email-campaign-task-runner.md)
- [`AGENTS/feature_requests/2026-03-25-transport-layer.md`](/home/shami/workspaces/relay/AGENTS/feature_requests/2026-03-25-transport-layer.md)
