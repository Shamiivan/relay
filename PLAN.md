# Relay — Digital Workspace Agent

> Note: Development is use-case-first. We are intentionally not building the full abstract system up front. The first vertical slice is: agent can access email. Architecture should stay minimal and only expand when a real use case forces it.

A composable workspace agent built on Unix philosophy and "Worse is Better".
Handles email, calendar, docs, campaigns — via Discord.

---

## Current State

### Agent Runtime (`cli.ts`)
Thread-based context with ephemeral sessions per turn. Each turn creates a fresh `createAgentSession` seeded with the full serialized thread — system prompt never drifts.

**Thread bootstrap (before turn 1):**
- `system_note` — CONTRACT with rules
- `executable_call/result` — `tree workflows` output (agent sees all tools immediately)
- `executable_call/result` — all `README.md` files pre-loaded (agent knows tool input/output format before acting)
- `user_message` — the user's request

**Loop:**
- Bash events (`tool_execution_start/end`) captured into thread → full tool call history visible across turns
- Terminal JSON parsed → `done_for_now` or `request_more_information`
- Parse failures → `system_note` re-prompt, continue
- `done_for_now` with zero bash calls after a human turn → `system_note` enforcement, continue
- `request_more_information` → ask human, append `human_response`, continue

**Approval gate:** destructive commands (`docs.write`, `drive.copy`) intercepted at the bash tool `execute` level — human must type `yes` before the command runs.

### Tool convention
- Workflow tools live in `workflows/<name>/tools/<tool>/run` — any executable that reads JSON from stdin and writes JSON to stdout
- **Tools can be any language** — bash, Python, Go, TypeScript, Ruby, anything. The only contract is stdin → stdout JSON
- Canonical TypeScript tools live in `tools/` — use `defineTool` + `runDeclaredTool` from `tools/sdk.ts`; workflow `run` scripts are bash shims that `exec tsx <tool.ts>`
- Each tool has a `README.md` with input schema, usage examples, and output shape
- `package.json` with `"bin": { "run": "./run" }` in every tool directory

**Tool output envelope — always the same shape:**
```json
{ "ok": true,  "result": { ... } }
{ "ok": false, "error":  { "type": "string", "message": "string" } }
```
- `ok: true` → success, data in `result`
- `ok: false` → failure, reason in `error.type` + optional `error.message`
- The agent checks `ok` first — no need to guess whether an empty array is an error or a valid empty result

### Workflows built
- `workflows/adding_numbers/` — add, subtract, multiply, divide
- `workflows/board_meeting_prep/` — drive.search, docs.read, docs.write, drive.copy, time.now
  - `drive.search` shims `tools/gworkspace/drive/drive.search/tool.ts` (googleapis + OAuth)
  - `docs.read` shims `tools/gworkspace/docs/docs.read/tool.ts`
  - `docs.write` shims `tools/gworkspace/docs/docs.write/tool.ts` ← approval-gated
  - `drive.copy` shims `tools/gworkspace/drive/drive.copy/tool.ts` ← approval-gated
  - `time.now` shims `tools/time/tool.ts` — returns ISO + local + timestamp

### Auth
Google OAuth via `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in `.env.local`. Loaded by dotenv in `cli.ts`; inherited by all bash subprocesses automatically.

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
