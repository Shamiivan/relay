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

**No BAML.** Anthropic SDK + Zod only.

---

## Stack

- **TypeScript** (pnpm workspaces)
- **Convex** — durable state + scheduler (IS the queue, no polling worker)
- **Anthropic SDK** — `betaZodTool` + `toolRunner()` (handles tool loop)
- **Discord.js** — entry point + HITL transport
- **Zod** — all validation, all type inference
- **.md files** — memory/preferences (read-only v1, human-curated)
- **YAML** — specialist registry + policy table (declaration, not code)

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
│   ├── specialists/      ← YAML (declaration only, no code)
│   │   ├── scheduling.yaml
│   │   ├── communication.yaml
│   │   ├── knowledge.yaml
│   │   └── email-campaigner.yaml
│   └── policies.yaml     ← flat rules: scope/flags → policy decision
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
└── convex/               ← all durable state + scheduler
    ├── schema.ts         ← runs, events, humanTasks, memory
    ├── runs.ts           ← create (+ scheduler), finish, pause, fail
    ├── events.ts         ← append (typed), getByThread
    ├── humanTasks.ts     ← create, resolve, listOpen
    ├── memory.ts         ← agent-inferred preferences
    └── agent.ts          ← internalAction: Anthropic toolRunner
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

## How Convex + Anthropic SDK fit together

```typescript
// convex/runs.ts — mutation schedules internalAction (Convex IS the queue)
export const create = mutation({
  handler: async (ctx, { message, userId }) => {
    const runId = await ctx.db.insert("runs", { message, userId, status: "pending", turnCount: 0 })
    await ctx.scheduler.runAfter(0, internal.agent.runAgentTurn, { runId })
  }
})

// convex/agent.ts — internalAction runs the turn
export const runAgentTurn = internalAction({
  handler: async (ctx, { runId }) => {
    const run     = await ctx.runQuery(api.runs.get, { runId })
    const spec    = loadSpecialist(run.specialistId)   // reads YAML
    const prompt  = fs.readFileSync(spec.promptFile)   // reads prompts/*.md
    const context = loadContextFiles(spec.contextFiles) // reads context/*.md
    const history = await ctx.runQuery(api.events.getByThread, { threadId: run.threadId })

    if (run.turnCount >= spec.maxTurns) {
      await ctx.runMutation(api.runs.fail, { runId, error: "max_turns_exceeded" })
      return
    }

    // build betaZodTools from adapter actions + policy guard
    const tools = buildTools(spec.tools, ctx, runId)

    // SDK handles the entire tool loop — no manual loop needed
    const result = await anthropic.beta.messages.toolRunner({
      model: "claude-sonnet-4-6",
      system: `${prompt}\n\n## Context\n${context}`,
      messages: history,
      tools,
      max_tokens: 4096,
      max_iterations: spec.maxTurns - run.turnCount
    })

    await ctx.runMutation(api.runs.finish, { runId, result: result.content })
  }
})
```

---

## Policy

```yaml
# configs/policies.yaml — flat, no DSL, no conditionals
- scope: read                              → allow
- scope: write                             → allow
- scope: schedule                          → allow
- tool: gmail,     operation: send         → confirm
- tool: instantly, operation: schedule     → always-hitl
- scope: admin                             → confirm
```

```typescript
// packages/policy/src/index.ts
type PolicyDecision = "allow" | "confirm" | "block"
export function check(descriptor: ActionDescriptor): PolicyDecision { ... }

// Inside betaZodTool.run:
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
Tool hits "confirm" → humanTask created → run paused → internalAction exits

Bot: global subscription to humanTasks { status: "pending" }
  → posts in Discord: "Approve: gmail.send to alice@co.com?"

User: "yes" → bot resolves humanTask → Convex re-queues run via scheduler
  → internalAction resumes → executes approved call
```

---

## Specialist Config

```yaml
# configs/specialists/communication.yaml
id: communication
promptFile: prompts/communication.system.md
triggers: [email, mail, inbox, message, reply]
tools: [gmail]
maxTurns: 8
contextFiles: [context/global.md]
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
- `convex/runs.ts` — create + finish
- `convex/agent.ts` — internalAction + toolRunner
- `packages/adapters/gmail/src/index.ts` — search, read
- `configs/specialists/communication.yaml`
- `prompts/communication.system.md`
- `context/global.md`
- `apps/bot/src/index.ts` — Discord → runs.create, watch for result

**Test:** *"what emails did Alice send me this week?"* → Gmail results returned → Discord responds

### Phase 1 — Email Send + HITL (~100 lines)
- `convex/humanTasks.ts`
- `packages/policy/src/index.ts`
- `packages/adapters/gmail/src/index.ts` — add `send`
- Bot: add global humanTasks subscription

**Test:** *"email alice the meeting details"* → Discord approval before anything sends

### Phase 2 — Calendar Slice
- `packages/adapters/gcal/src/index.ts` — findTime, createEvent
- `configs/specialists/scheduling.yaml`
- `prompts/scheduling.system.md`
- `context/board-meeting.md`

**Test:** *"create a meeting with Alice tomorrow at 2pm"* → event created → Discord confirms

### Phase 3 — Memory
- `convex/memory.ts`

**Test:** Second board meeting request → preferences recalled, no repeated questions

### Phase 4 — Second Specialist (extensibility proof)
- `packages/adapters/gsheets/src/index.ts`
- `configs/specialists/knowledge.yaml`
- `prompts/knowledge.system.md`
- `context/time-tracker.md`

**Test:** *"update time tracker from Alice's email"* → zero changes to agent.ts, bot, or communication files

---

## Adding a New Specialist Later (email-campaigner example)

1. `packages/adapters/apollo/` — Apollo API wrapper
2. `packages/adapters/instantly/` — Instantly API wrapper
3. `configs/specialists/email-campaigner.yaml`
4. `prompts/email-campaigner.system.md`
5. `context/email-campaigns.md`
6. Entries in `configs/policies.yaml` for bulk send

**Zero changes** to: agent.ts, bot, other specialists, Convex schema.

---

## What Each Part Knows

| Part | Knows | Does NOT know |
|------|-------|---------------|
| `adapters/*` | External API, rate limits, Zod schemas | Specialists, Convex, prompts |
| `policy/` | ActionDescriptor → decision | Provider SDKs, Anthropic, Convex |
| `convex/agent.ts` | Anthropic SDK, adapters, policy | Discord, CLI details |
| `apps/bot/` | Discord API, Convex mutations | Agent logic, adapter internals |
| `configs/*.yaml` | Specialist declaration | Runtime behavior |
| `prompts/*.md` | LLM instructions | Code, APIs, Convex |
| `context/*.md` | User preferences | Everything runtime |
