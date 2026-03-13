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