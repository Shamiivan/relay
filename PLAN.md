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


---

## Stack

- **TypeScript** (pnpm workspaces)
- **Convex** — durable state + run/event store
- **Runtime worker** — local Node process that claims pending runs and executes agent work
- **Model provider layer** — swappable LLM backend for tool calling + structured outputs
- **Gemini** — first provider implementation
- **Discord.js** — entry point + HITL transport
- **Zod** — all validation, all type inference
- **.md files** — memory/preferences (read-only v1, human-curated)
- **JSON** — specialist registry + policy table (declaration, not code)

---

## Structure

```
relay/
├── packages/
│   ├── adapters/         ← one per external system, usable standalone
│   │   ├── gmail/        ← search, read (Phase 0), send (Phase 1)
│   │   ├── gcal/         ← findTime, createEvent (Phase 2)
│   │   ├── gsheets/      ← readValues, appendRow (Phase 4)
│   │   ├── gdocs/
│   │   ├── apollo/
│   │   └── instantly/
│   └── policy/           ← check(ActionDescriptor) → allow|confirm|block
│
├── apps/
│   └── bot/              ← Discord transport only. Calls Convex mutations.
│
├── configs/
│   ├── specialists/      ← JSON (declaration only, no code)
│   │   ├── scheduling.json
│   │   ├── communication.json
│   │   ├── knowledge.json
│   │   └── email-campaigner.json
│   └── policies.json     ← flat rules: scope/flags → policy decision
│
├── prompts/              ← system prompt .md files (versioned, editable)
│   ├── scheduling.system.md
│   ├── communication.system.md
│   ├── knowledge.system.md
│   └── email-campaigner.system.md
│
├── context/              ← memory .md files (READ-ONLY, human-curated)
│   ├── global.md         ← timezone, name, working hours
│   ├── board-meeting.md  ← attendees, format, duration
│   ├── time-tracker.md   ← spreadsheetId, column mapping
│   └── clients/
│
├── runtime/              ← local worker process for agent execution
│   └── src/
│       └── worker.ts     ← claims pending runs, loads local files, calls adapters
│
└── convex/               ← all durable state
    ├── schema.ts         ← runs, events, humanTasks, memory
    ├── runs.ts           ← create, listPending, claim, finish, fail
    ├── events.ts         ← append (typed), getByRun
    ├── humanTasks.ts     ← create, resolve, listOpen
    └── memory.ts         ← agent-inferred preferences
```

---

## Core Types (packages/contracts or inline in adapters)

```typescript
// Every adapter action declares this
type ActionDescriptor = {
  tool:      string
  operation: string
  scope:     "read" | "write" | "send" | "schedule" | "admin"
  flags?:    ("external" | "irreversible" | "bulk")[]
}

// Every adapter action returns this
type AdapterResult = {
  ok:     boolean
  data?:  unknown        // minimal — only what LLM needs
  error?: NamedError
}

// Named errors — no regex, no string matching
type NamedError =
  | { type: "auth_error" }
  | { type: "rate_limit";      retryAfterMs: number }
  | { type: "not_found";       id: string }
  | { type: "validation";      field: string; reason: string }
  | { type: "conflict";        detail: string }
  | { type: "external_error";  message: string }
```

---

## Adapter Contract (every adapter follows this)

```typescript
export const gcal = {
  id: "gcal",
  actions: {
    createEvent: {
      descriptor: { tool: "gcal", operation: "create-event", scope: "schedule" },
      input:   z.object({ title: z.string(), start: z.string(), duration: z.number(),
                           attendees: z.array(z.string()).optional(), meetLink: z.boolean().optional() }),
      output:  z.object({ eventId: z.string(), meetLink: z.string().optional() }),
      execute: async (input) => { /* calls googleapis */ }
    }
  }
}
```

Rules:
- Input validated by Zod before any API call
- Output stripped to only what LLM needs — no raw API responses
- Errors are named types
- No adapter imports another adapter
- No adapter knows about specialists or policies

---

## How Convex + Worker fit together

```typescript
// convex/runs.ts — mutation inserts a pending run
export const create = mutation({
  handler: async (ctx, { message, userId }) => {
    const runId = await ctx.db.insert("runs", {
      message,
      userId,
      status: "pending",
      turnCount: 0
    })
  }
})

// runtime/src/worker.ts — local process claims and executes pending work
convex.onUpdate(api.runs.listPending, {}, async () => {
  for (;;) {
    const run = await convex.mutation(api.runs.claim, {})
    if (!run) break

    const spec    = loadSpecialist(run.specialistId)     // reads JSON locally
    const prompt  = fs.readFileSync(spec.promptFile)     // reads prompts/*.md locally
    const context = loadContextFiles(spec.contextFiles)  // reads context/*.md locally

    const result = await gmail.search({ query: run.message })

    if (!result.ok) {
      await convex.mutation(api.runs.fail, {
        runId: run._id,
        errorType: result.error.type,
        errorMessage: "Gmail search failed"
      })
      continue
    }

    await convex.mutation(api.events.append, {
      runId: run._id,
      kind: "agent_output",
      text: formatSearchResult(result.data)
    })
    await convex.mutation(api.runs.finish, {
      runId: run._id,
      outputText: formatSearchResult(result.data)
    })
  }
})
```

---

## Policy

```json
[
  { "scope": "read", "decision": "allow" },
  { "scope": "write", "decision": "allow" },
  { "scope": "schedule", "decision": "allow" },
  { "tool": "gmail", "operation": "send", "decision": "confirm" },
  { "tool": "instantly", "operation": "schedule", "decision": "confirm" },
  { "scope": "admin", "decision": "confirm" }
]
```

```typescript
// packages/policy/src/index.ts
type PolicyDecision = "allow" | "confirm" | "block"
export function check(descriptor: ActionDescriptor): PolicyDecision { ... }

// Inside the model tool execution loop:
const decision = policy.check(action.descriptor)
if (decision === "block")   throw new Error("blocked_by_policy")
if (decision === "confirm") {
  await ctx.runMutation(api.humanTasks.create, { runId, proposedCall: { ... } })
  await ctx.runMutation(api.runs.pause, { runId })
  return "paused_for_approval"
}
// allow → execute
```

---

## Durable HITL

```
Tool hits "confirm" → humanTask created → run paused → worker stops processing that run

Bot: global subscription to humanTasks { status: "pending" }
  → posts in Discord: "Approve: gmail.send to alice@co.com?"

User: "yes" → bot resolves humanTask → run moves back to pending
  → worker claims it again → executes approved call
```

---

## Specialist Config

```json
{
  "id": "communication",
  "promptFile": "prompts/communication.system.md",
  "triggers": ["email", "mail", "inbox", "message", "reply"],
  "tools": ["gmail"],
  "maxTurns": 8,
  "contextFiles": ["context/global.md"]
}
```

```markdown
<!-- prompts/communication.system.md -->
You are a communication specialist. You manage inbox access and email drafting.

Rules:
- Start with read-only actions unless the user explicitly asks to send.
- Summarize relevant emails clearly and minimally.
- If recipient identity is ambiguous, ask before sending anything.
- Never send an email without policy approval.

You have access to: gmail.
User context is below.
```

---

## Memory

- `context/*.md` — READ-ONLY in v1. Human writes. Agent reads.
- `convex/memory` table — agent-inferred preferences (scope + key + value)
- Later: human promotes `memory` entries to `context/*.md` when confident

---

## Build Order

### Phase 0 — Email Read Slice (~200-300 lines, proves the pipe)
Files to build:
- `convex/schema.ts` — runs table
- `convex/runs.ts` — create + claim + finish
- `runtime/src/worker.ts` — local worker + Gmail execution
- `packages/adapters/gmail/src/index.ts` — search, read
- `configs/specialists/communication.json`
- `prompts/communication.system.md`
- `context/global.md`
- `apps/bot/src/index.ts` — Discord → runs.create, watch for result

**Test:** *"what emails did Alice send me this week?"* → Gmail results returned → Discord responds

Status:
- The pipe exists today as a deterministic Gmail-read slice.
- Gmail auth is connected locally.
- The next step is replacing the hard-coded worker behavior with a provider-agnostic model tool loop.
- Gemini is the starting provider, not a permanent architectural dependency.

### Phase 1 — Email Send + HITL (~100 lines)
- `convex/humanTasks.ts`
- `packages/policy/src/index.ts`
- `packages/adapters/gmail/src/index.ts` — add `send`
- Bot: add global humanTasks subscription

**Test:** *"email alice the meeting details"* → Discord approval before anything sends

Dependency:
- Build this after the model layer is choosing tool calls, so approval gates a model-selected `gmail.send` action instead of hard-coded branching.

### Phase 2 — Calendar Slice
- `packages/adapters/gcal/src/index.ts` — findTime, createEvent
- `configs/specialists/scheduling.json`
- `prompts/scheduling.system.md`
- `context/board-meeting.md`

**Test:** *"create a meeting with Alice tomorrow at 2pm"* → event created → Discord confirms

### Phase 3 — Memory
- `convex/memory.ts`

**Test:** Second board meeting request → preferences recalled, no repeated questions

### Phase 4 — Second Specialist (extensibility proof)
- `packages/adapters/gsheets/src/index.ts`
- `configs/specialists/knowledge.json`
- `prompts/knowledge.system.md`
- `context/time-tracker.md`

**Test:** *"update time tracker from Alice's email"* → zero changes to worker, bot, or communication files

---

## Adding a New Specialist Later (email-campaigner example)

1. `packages/adapters/apollo/` — Apollo API wrapper
2. `packages/adapters/instantly/` — Instantly API wrapper
3. `configs/specialists/email-campaigner.json`
4. `prompts/email-campaigner.system.md`
5. `context/email-campaigns.md`
6. Entries in `configs/policies.json` for bulk send

**Zero changes** to: worker.ts, bot, other specialists, Convex schema.

---

## What Each Part Knows

| Part | Knows | Does NOT know |
|------|-------|---------------|
| `adapters/*` | External API, rate limits, Zod schemas | Specialists, Convex, prompts |
| `policy/` | ActionDescriptor → decision | Provider SDKs, model runtime, Convex |
| `runtime/src/worker.ts` | Local file loading, adapters, execution loop | Discord transport |
| `apps/bot/` | Discord API, Convex mutations | Agent logic, adapter internals |
| `configs/*.json` | Specialist declaration | Runtime behavior |
| `prompts/*.md` | LLM instructions | Code, APIs, Convex |
| `context/*.md` | User preferences | Everything runtime |
