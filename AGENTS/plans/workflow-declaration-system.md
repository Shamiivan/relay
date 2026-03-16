# Workflow Declaration System

## User Story

```
As a developer adding a new workflow to Relay,
I want to declare a workflow in one file (like a tool)
and have codegen handle registration and typing,
So that I never have to manually wire workflows and
every workflow follows the same contract.
```

---

## Problem

Workflows today are "routines" — ad-hoc TypeScript interceptors with:
- No declared contract (name, tools, state shape, steps)
- No codegen support — registration is manual
- No structural relationship to the tools system
- One 550-line monolithic file for `board-meeting-prep` with an implicit state machine

The fix mirrors the tools pattern: one `workflow.ts` per workflow, declaration + implementation co-located, codegen generates the registry.

---

## Runtime Relationship

`run` remains the execution primitive.

A run executes in one of two modes:

- `open_loop`
- `workflow`

`workflow` is not a separate execution container.
It is a declared contract that a `run` can execute when
`run.executionMode === "workflow"`.

That means:

- `session` owns continuity
- `run` owns one execution
- `run.executionMode` selects `open_loop` or `workflow`
- workflow continuity may persist in `session`
- `runStep`, `toolCall`, and `event` are shared across both modes

The declaration system in this plan is about making workflow behavior declarative and codegenerated, not about replacing `run` as the runtime unit.

---

## Slices

### Slice 1 — Developer can declare a workflow and see it in the registry (Day 1)

**Value:** Write `defineWorkflow()` in a file → run `pnpm codegen:workflows` → see the workflow registered with full types. No runtime changes yet.

**What to build:**
- `workflows/sdk.ts` — `defineWorkflow()`, `WorkflowDeclaration` brand type, `WorkflowStepContext`, `WorkflowStepResult`
- `workflows/codegen.ts` — scans `workflows/*/workflow.ts`, imports, validates prompt files + tool names, emits `_generated/`
- `workflows/_generated/registry.ts` — `workflowRegistry`, `WorkflowName` union, `getWorkflow(name)`
- `workflows/_generated/types.ts` — inferred state/trigger types
- Add `"codegen:workflows": "tsx workflows/codegen.ts"` to `package.json`

**Shape (workflows/sdk.ts):**
```ts
defineWorkflow({
  name: "board_meeting_prep",
  description: "...",
  specialist: "communication",
  trigger: { matches: (ctx) => ctx.run.message.includes("board") },
  state: z.object({ step: z.string(), ... }),
  initialState: { step: "find_reference" },
  prompt: promptFile("./prompt.md"),
  tools: ["drive.search", "drive.copy", "docs.read", "docs.write"],
  steps: {
    async find_reference(ctx) { ... return { nextStep: "select_reference", state: {...} }; },
    async select_reference(ctx) { ... },
    ...
  },
  initialStep: "find_reference",
});
```

**Done when:** `pnpm codegen:workflows` runs without errors and `_generated/registry.ts` exports the workflow. `pnpm typecheck` passes.

---

### Slice 2 — Runtime dispatches to a declared workflow (Day 2)

**Value:** A run whose message matches a workflow now executes in `workflow` mode and enters the declared step handlers. State persists in Convex across turns.

**What to build:**
- `convex/schema.ts` — add `activeWorkflowName`, `workflowStateJson`, `workflowStepName` to `sessions`; add `workflowName`, `workflowVersion` to `runs`; add `"workflow_step"` to `runSteps.kind`
- `runtime/src/primitives/` — update session + runStep types
- `runtime/src/execution/workflow.ts` (new) — dispatch engine:
  - If no active workflow: run each `trigger.matches()` to find one
  - If a workflow matches: execute the run in `workflow` mode and persist `workflowName` on the run
  - Parse state, call current step handler, persist result to session
  - On `nextStep === undefined`: clear workflow from session
  - Record `runStep` of kind `"workflow_step"`
- `runtime/src/execution/run-loop.ts` — check for active/triggered workflow before falling through to open-loop

**Done when:** Sending a "board meeting prep" message creates a run that executes in `workflow` mode, a `workflow_step` runStep appears in Convex, and session holds updated workflow state.

---

### Slice 3 — Migrate board-meeting-prep to the new system (Day 3)

**Value:** The real, working workflow runs through the new declaration system. Routines folder is deleted.

**What to build:**
- `workflows/board-meeting-prep/workflow.ts` — full `defineWorkflow()` with all 5 step handlers extracted from the existing routine:
  - `find_reference` → search Drive for Board folder
  - `select_reference` → pick most recent reference doc
  - `create_working_doc` → copy and rename
  - `revise_doc` → apply changes
  - `finalize` → notify user
- `workflows/board-meeting-prep/prompt.md` — extracted prompt content
- Delete `runtime/src/routines/` entirely

**Done when:** End-to-end board meeting prep request in Discord completes correctly using the new system. No code in `routines/`.

---

## File Map

| File | Slice | Change |
|------|-------|--------|
| `workflows/sdk.ts` | 1 | New — `defineWorkflow()`, all shared types |
| `workflows/codegen.ts` | 1 | New — scanner + code generator |
| `workflows/_generated/registry.ts` | 1 | Generated — workflow registry |
| `workflows/_generated/types.ts` | 1 | Generated — inferred types |
| `package.json` | 1 | Add `codegen:workflows` script |
| `convex/schema.ts` | 2 | Add workflow continuity fields to sessions, workflow identity to runs, `workflow_step` kind |
| `runtime/src/primitives/` | 2 | Update session/runStep types |
| `runtime/src/execution/workflow.ts` | 2 | New — workflow dispatch engine |
| `runtime/src/execution/run-loop.ts` | 2 | Add workflow dispatch before open-loop |
| `workflows/board-meeting-prep/workflow.ts` | 3 | New — migrated from routine |
| `workflows/board-meeting-prep/prompt.md` | 3 | New — extracted prompt |
| `runtime/src/routines/` | 3 | Delete |

---

## Verification (per slice)

**Slice 1:**
```bash
pnpm codegen:workflows   # no errors
pnpm typecheck           # no new errors
# inspect _generated/registry.ts — workflowRegistry has board_meeting_prep
```

**Slice 2:**
- Send "prepare board meeting" in Discord
- Check Convex dashboard: `runs.executionMode === "workflow"`, `runSteps` has `kind: "workflow_step"`, `sessions` has `activeWorkflowName`
- Send follow-up message: workflow resumes from saved step

**Slice 3:**
- Full board meeting prep flow completes end-to-end in Discord
- `runtime/src/routines/` directory is gone
- `pnpm typecheck` passes
