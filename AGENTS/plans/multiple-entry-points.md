# Plan: Multiple Entry Points — TUI (pi-tui) + Inspector (Ink)

## Context
Relay currently only has a Discord bot as its entry point. We want to add a **coding-agent TUI** (like Claude Code / Codex) as the primary interface, plus keep the existing Ink app renamed as an **inspector**. The TUI uses a ported version of `pi-tui` for interactive mode (differential rendering, better for streaming transcripts) and `cac` as the CLI framework. All state is already in Convex — transports only enqueue runs and subscribe to results.

**Naming:**
- `relay tui` → pi-tui interactive shell (the thing you chat with)
- `relay inspector` → Ink ops dashboard (queue, steps, tool calls)
- `apps/cli/` → entry point for both commands
- `apps/tui/` → renamed to `apps/inspector/`

**Problem:** The Convex schema (`sessions`, `runs`) is Discord-coupled — `channelId` is hardcoded. This must be generalized first before any new transport can work.

---

## Transport Layer Architecture (ported from openclaw)

Openclaw uses a `ChannelPlugin` pattern — each transport implements `gateway` (inbound) and `outbound` (delivery). We port a simplified version of this into `packages/transport/`.

### The Transport Interface (`packages/transport/src/types.ts`)

```ts
export type TransportId = "discord" | "cli" | "tui"

export interface Transport {
  id: TransportId
  // Inbound: start listening for user input and enqueue runs
  // Outbound: watch Convex for deliverable runs and deliver them
  start(convex: ConvexClient, env: Env): Promise<void>
  stop(): Promise<void>
}
```

Every transport does TWO things inside `start()`:
1. **Inbound** — listen for user messages → call `api.runs.create({ ..., transport: id })`
2. **Outbound** — subscribe to `api.runs.listDeliverable({ transport: id })` → deliver result

The `transport` field on runs means each transport only delivers its own runs — Discord never tries to deliver CLI runs, and vice versa.

### Concrete Transports

```
packages/transport/src/
  types.ts          ← Transport interface
  discord.ts        ← DiscordTransport (extracted from apps/bot/src/index.ts)
  cli.ts            ← CliTransport (one-shot: argv → stdout)
  tui.ts            ← TuiTransport (interactive: pi-tui editor → event stream)
```

**DiscordTransport** (refactored from `apps/bot/src/index.ts`):
```ts
export class DiscordTransport implements Transport {
  id = "discord" as const
  async start(convex, env) {
    // Inbound: discord.js message listener → api.runs.create({ threadKey: channelId, transport: "discord" })
    // Outbound: convex.onUpdate(api.runs.listDeliverable, { transport: "discord" }, ...)
    //           → channel.send(run.outputText) → api.runs.markDelivered(runId)
  }
}
```

**CliTransport** (new, one-shot):
```ts
export class CliTransport implements Transport {
  id = "cli" as const
  async start(convex, env) {
    // Inbound: process.argv → api.runs.create({ threadKey: "cli-session", transport: "cli" })
    // Outbound: convex.onUpdate(api.runs.get(runId), ...) → process.stdout → process.exit(0)
  }
}
```

**TuiTransport** (new, interactive):
```ts
export class TuiTransport implements Transport {
  id = "tui" as const
  async start(convex, env) {
    // Inbound: pi-tui Editor.onSubmit → api.runs.create({ threadKey: sessionKey, transport: "tui" })
    // Outbound: convex.onUpdate(events.listByRun(runId), ...) → renderEvent(kind) → chatContainer
  }
}
```

### Entry points become thin:

`apps/bot/src/index.ts`:
```ts
const transport = new DiscordTransport()
await transport.start(convex, env)
```

`apps/cli/src/commands/run.ts`:
```ts
const transport = new CliTransport({ prompt: args[0] })
await transport.start(convex, env)
```

`apps/cli/src/commands/tui.ts`:
```ts
const transport = new TuiTransport()
await transport.start(convex, env)
```

### Update `listDeliverable` query
`convex/runs.ts` — add `transport` filter so each transport only sees its own runs:
```ts
export const listDeliverable = query({
  args: { transport: v.optional(TransportValidator) },
  handler: (ctx, { transport }) =>
    ctx.db.query("runs")
      .withIndex("by_delivery_state", q => q.eq("deliveryState", "ready"))
      .filter(q => transport ? q.eq(q.field("transport"), transport) : true)
      .collect()
})
```

---

## The Kind Workflow Pattern (from twelve-factor-agents)

Inspired by `/home/shami/workspaces/ai-that-works/2025-04-22-twelve-factor-agents/step-by-step/src/agent.ts`.

The Thread is an append-only event log. The TUI subscribes and switches on `kind` to render each event:

```ts
// Thread = append-only event log
thread.events.push({ type: "tool_call", data: nextStep })

// Rendering: switch on kind/intent
switch (nextStep.intent) {
  case "done_for_now":              // → show assistant message
  case "request_more_information":  // → prompt human
  case "add": case "subtract":      // → show tool + result
}
```

**Relay already implements this** — Convex IS the Thread:

| Twelve-factor | Relay equivalent |
|---|---|
| `Thread.events[]` | `events` table in Convex |
| `event.type` / `data.intent` | `events.kind`, `runSteps.kind`, `toolCalls.toolKind` |
| `agentLoop` switch | Worker's `runLoop` |
| `request_more_information` | `toolCalls.toolKind === "human"` |
| `done_for_now` | `run.status === "done"` |

**The TUI subscribes to the event stream and renders each event by its `kind`:**

```ts
// apps/cli/src/tui/thread.ts
function renderEvent(event: Event, ui: TUI, chatContainer: Container) {
  switch (event.kind) {
    case "run.created":
      chatContainer.addChild(new UserMessage(event.dataJson)); break
    case "run.claimed":
      chatContainer.addChild(new Loader("thinking...")); break
    case "run.completed":
      chatContainer.addChild(new AssistantMessage(event.dataJson)); break
    case "run.failed":
      chatContainer.addChild(new ErrorMessage(event.dataJson)); break
  }
  ui.requestRender()
}
```

For tool calls (from `toolCalls.listByRun`):
```ts
switch (toolCall.toolKind) {
  case "machine": // → ToolCallComponent (name + status + result)
  case "human":   // → HumanApprovalComponent (prompt + buttons)
}
```

Single subscription drives the entire transcript — switch on `kind`, no bespoke rendering per-feature.

---

## Slice 1: Generalize Convex Schema

**Goal:** Make sessions/runs transport-neutral.

### Files to modify:
- `convex/schema.ts` — Replace `channelId: v.string()` with `threadKey: v.string()`, add `transport: v.union(v.literal("discord"), v.literal("cli"), v.literal("tui"))` on both `sessions` and `runs` tables. Update index `by_channel_user_specialist` → `by_thread_user_specialist`.
- `convex/runs.ts` — Update `create` args: replace `channelId` with `threadKey` + `transport`. Update session lookup.
- `apps/bot/src/index.ts` — Pass `threadKey: message.channelId, transport: "discord"`.
- `convex/_generated/` — Regenerate via `pnpm convex:codegen`.

**No behavior change** — Discord bot still works identically; channelId is now called threadKey.

---

## Slice 1.5: Transport Package

**Goal:** Create `packages/transport/` with the Transport interface and refactor bot to use it.

```
packages/transport/src/
  types.ts      ← Transport interface + TransportId type
  discord.ts    ← DiscordTransport (logic moved from apps/bot/src/index.ts)
  cli.ts        ← CliTransport stub
  tui.ts        ← TuiTransport stub
  index.ts      ← re-exports
```

`apps/bot/src/index.ts` shrinks to ~10 lines: load env, create convex, `new DiscordTransport().start(convex, env)`.

---

## Slice 2: `relay run "<prompt>"` — One-Shot CLI

**Goal:** Prove a non-Discord transport can enqueue a run and receive output end-to-end.

### New app: `apps/cli/`

**`apps/cli/package.json`**
```json
{
  "name": "@relay/cli",
  "bin": { "relay": "./src/index.ts" },
  "dependencies": { "cac": "^6.7.14", "@relay/transport": "workspace:*" }
}
```

**`apps/cli/src/cli.ts`** — CLI setup with `cac`
```ts
import cac from "cac"
const cli = cac("relay")
cli.command("[prompt]", "Run agent one-shot or open interactive TUI").action(runCommand)
cli.command("tui", "Open interactive TUI shell").action(tuiCommand)
cli.command("inspector", "Open Ink ops inspector").action(inspectorCommand)
cli.help()
cli.parse(["node", "relay", ...args])
```

**`apps/cli/src/commands/run.ts`** — uses `CliTransport` from `@relay/transport`

Add `"cli": "tsx apps/cli/src/index.ts"` to root `package.json` scripts.

---

## Slice 2.5: Port pi-tui into `packages/tui/`

**Goal:** Minimal TUI library in relay's own codebase — no external install.

**Source:** `/home/shami/workspaces/pi-mono/packages/tui/src/`

### Port these files only:

| File | Source | Purpose |
|---|---|---|
| `packages/tui/src/tui.ts` | `tui.ts` | Core TUI, differential rendering |
| `packages/tui/src/terminal.ts` | `terminal.ts` | ProcessTerminal — raw mode, stdin |
| `packages/tui/src/container.ts` | extract from `tui.ts` | Container — composes children |
| `packages/tui/src/keys.ts` | `keys.ts` | `matchesKey`, `parseKey`, `Key` |
| `packages/tui/src/utils.ts` | `utils.ts` | `visibleWidth`, `wrapTextWithAnsi` |
| `packages/tui/src/components/text.ts` | `components/text.ts` | Static text |
| `packages/tui/src/components/input.ts` | `components/input.ts` | Single-line input |
| `packages/tui/src/components/loader.ts` | `components/loader.ts` | Spinner |
| `packages/tui/src/components/markdown.ts` | `components/markdown.ts` | Markdown rendering |
| `packages/tui/src/index.ts` | `index.ts` | Re-exports |

### Skip:
- `editor.ts` (2,183 lines — full code editor, overkill)
- `terminal-image.ts`, `stdin-buffer.ts`, `keybindings.ts`, `select-list.ts`
- Windows `koffi` FFI

### Only external deps needed:
- `marked` — markdown
- `get-east-asian-width` — CJK width

**`packages/tui/package.json`**
```json
{
  "name": "@relay/tui",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "marked": "^9.0.0", "get-east-asian-width": "^1.0.0" }
}
```

---

## Slice 3: `relay tui` — Interactive Shell

**Goal:** Full coding-agent interactive REPL with kind-driven streaming transcript.

**`apps/cli/src/tui/thread.ts`** — Kind-based event renderer
- Subscribes to `events.listByRun(runId)` + `toolCalls.listByRun(runId)`
- Tracks `renderedEventIds: Set<string>` — only renders new events
- Switches on `event.kind` / `toolCall.toolKind` → adds component to `chatContainer`
- Restores editor focus on `run.status === "done"` or `"failed"`

**`apps/cli/src/tui/interactive.ts`** — InteractiveMode
- Layout: `chatContainer` (transcript) → `statusContainer` (loader) → `editorContainer` (input)
- On submit: append UserMessage, `api.runs.create(...)`, pass runId to thread renderer

**`apps/cli/src/tui/components/`**
- `UserMessage.ts` — user message bubble
- `AssistantMessage.ts` — Markdown response
- `ToolCallComponent.ts` — machine tool: name + status + result
- `HumanApprovalComponent.ts` — human tool: prompt for input
- `ErrorMessage.ts` — run failure display

---

## Slice 4: `relay inspector` → Ink Ops Dashboard

**Goal:** Rename `apps/tui/` → `apps/inspector/`, wire as `relay inspector`.

- Rename: `apps/tui/` → `apps/inspector/`
- Update package name to `@relay/inspector`
- `apps/cli/src/commands/inspector.ts` → spawns `apps/inspector/src/index.tsx`

---

## Automated Checks

Create `scripts/verify-cli.sh`. Codex runs this after each slice — `set -e` means it fails fast.

```bash
#!/usr/bin/env bash
set -e
SLICE=${1:-all}

# ── Slice 1: Schema ───────────────────────────────────────────────
if [[ "$SLICE" == "1" || "$SLICE" == "all" ]]; then
  echo "=== Slice 1: Schema ==="
  pnpm check
  grep -q "threadKey" convex/_generated/api.d.ts && echo "✅ threadKey in generated types"
  ! grep -q "channelId" convex/_generated/api.d.ts && echo "✅ channelId removed"
  echo "✅ Slice 1 PASS"
fi

# ── Slice 1.5: Transport package ──────────────────────────────────
if [[ "$SLICE" == "1.5" || "$SLICE" == "all" ]]; then
  echo "=== Slice 1.5: Transport layer ==="
  test -f packages/transport/src/types.ts && echo "✅ Transport interface exists"
  test -f packages/transport/src/discord.ts && echo "✅ DiscordTransport exists"
  test -f packages/transport/src/cli.ts && echo "✅ CliTransport exists"
  test -f packages/transport/src/tui.ts && echo "✅ TuiTransport exists"
  grep -q "DiscordTransport" apps/bot/src/index.ts && echo "✅ bot uses DiscordTransport"
  grep -q "transport" convex/runs.ts && echo "✅ listDeliverable has transport filter"
  pnpm check
  echo "✅ Slice 1.5 PASS"
fi

# ── Slice 2: One-shot CLI ─────────────────────────────────────────
if [[ "$SLICE" == "2" || "$SLICE" == "all" ]]; then
  echo "=== Slice 2: One-shot CLI ==="
  test -f apps/cli/src/index.ts && echo "✅ apps/cli/src/index.ts exists"
  test -f apps/cli/src/commands/run.ts && echo "✅ run command exists"
  test -f apps/cli/package.json && echo "✅ apps/cli/package.json exists"
  grep -q '"cac"' apps/cli/package.json && echo "✅ cac dependency present"
  pnpm check
  tsx apps/cli/src/index.ts --help && echo "✅ CLI --help exits cleanly"
  echo "✅ Slice 2 PASS"
fi

# ── Slice 2.5: pi-tui port ────────────────────────────────────────
if [[ "$SLICE" == "2.5" || "$SLICE" == "all" ]]; then
  echo "=== Slice 2.5: @relay/tui port ==="
  test -f packages/tui/src/tui.ts && echo "✅ tui.ts ported"
  test -f packages/tui/src/terminal.ts && echo "✅ terminal.ts ported"
  test -f packages/tui/src/components/input.ts && echo "✅ input.ts ported"
  test -f packages/tui/src/components/markdown.ts && echo "✅ markdown.ts ported"
  grep -q "@relay/tui" apps/cli/package.json && echo "✅ @relay/tui dep present"
  pnpm check
  echo "✅ Slice 2.5 PASS"
fi

# ── Slice 3: Interactive TUI ──────────────────────────────────────
if [[ "$SLICE" == "3" || "$SLICE" == "all" ]]; then
  echo "=== Slice 3: Interactive TUI ==="
  test -f apps/cli/src/tui/interactive.ts && echo "✅ interactive.ts exists"
  test -f apps/cli/src/tui/thread.ts && echo "✅ thread.ts (kind renderer) exists"
  test -f apps/cli/src/tui/components/UserMessage.ts && echo "✅ UserMessage exists"
  test -f apps/cli/src/tui/components/AssistantMessage.ts && echo "✅ AssistantMessage exists"
  test -f apps/cli/src/tui/components/ToolCallComponent.ts && echo "✅ ToolCallComponent exists"
  test -f apps/cli/src/tui/components/HumanApprovalComponent.ts && echo "✅ HumanApprovalComponent exists"
  grep -q "event.kind" apps/cli/src/tui/thread.ts && echo "✅ kind-based rendering in thread.ts"
  grep -q '"tui"' apps/cli/src/cli.ts && echo "✅ tui subcommand registered"
  pnpm check
  echo "✅ Slice 3 PASS"
fi

# ── Slice 4: relay inspector ──────────────────────────────────────
if [[ "$SLICE" == "4" || "$SLICE" == "all" ]]; then
  echo "=== Slice 4: relay inspector ==="
  test -d apps/inspector && echo "✅ apps/inspector exists"
  ! test -d apps/tui && echo "✅ apps/tui renamed"
  test -f apps/cli/src/commands/inspector.ts && echo "✅ inspector command exists"
  grep -q '"inspector"' apps/cli/src/cli.ts && echo "✅ inspector subcommand registered"
  pnpm check
  echo "✅ Slice 4 PASS"
fi

echo ""
echo "All checks passed for slice: $SLICE"
```

**Usage:**
```sh
bash scripts/verify-cli.sh 1     # after slice 1
bash scripts/verify-cli.sh 1.5   # after slice 1.5
bash scripts/verify-cli.sh all   # full check
```

---

## Critical Files

| File | Change |
|---|---|
| `convex/schema.ts` | `threadKey` + `transport` fields (replaces `channelId`) |
| `convex/runs.ts` | Update `create` args, add transport filter to `listDeliverable` |
| `apps/bot/src/index.ts` | Shrinks to ~10 lines using `DiscordTransport` |
| `apps/tui/` → `apps/inspector/` | Rename directory + package name |
| `packages/transport/src/types.ts` | `Transport` interface |
| `packages/transport/src/discord.ts` | `DiscordTransport` |
| `packages/transport/src/cli.ts` | `CliTransport` |
| `packages/transport/src/tui.ts` | `TuiTransport` |
| `packages/tui/src/` | Port of pi-tui (tui, terminal, keys, utils, components) |
| `apps/cli/package.json` | New app — `cac` + `@relay/transport` + `@relay/tui` |
| `apps/cli/src/index.ts` | Entry point (`#!/usr/bin/env tsx`) |
| `apps/cli/src/cli.ts` | `cac` setup — `tui` + `inspector` subcommands |
| `apps/cli/src/tui/thread.ts` | Kind-based event renderer |
| `apps/cli/src/tui/interactive.ts` | InteractiveMode (layout + editor loop) |
| `package.json` (root) | Add workspace entries + scripts |

---

## Verification

### Slice 1 — Schema
✅ `pnpm check` passes, `threadKey` in generated types, no `channelId` references
❌ Any TS error referencing `channelId`, Convex schema rejection

### Slice 1.5 — Transport package
✅ All transport files exist, bot uses `DiscordTransport`, `listDeliverable` accepts transport arg
❌ Bot still has inline Discord logic, TS errors in transport package

### Slice 2 — One-shot CLI
✅ `relay run "say hello"` prints output and exits 0
❌ Hangs forever (subscription not wiring), crashes with env error, prints `undefined`

### Slice 2.5 — pi-tui port
✅ `@relay/tui` imports cleanly, `pnpm check` passes
❌ Missing files, import errors, TS errors from ported code

### Slice 3 — Interactive TUI
✅ `relay tui` opens shell, input submits, transcript updates live, second message works, Ctrl+C exits
❌ Garbage terminal output (TUI init failed), frozen after first message, transcript never updates

### Slice 4 — Inspector
✅ `relay inspector` opens Ink dashboard, shows runs from previous slices, `q` exits
❌ `apps/tui/` directory still exists, `inspector` command not registered
