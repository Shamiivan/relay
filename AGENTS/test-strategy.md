# Test Strategy

Generated: 2026-03-20

---

## Stack

TypeScript + Node.js built-in test runner (`node:test`) + `tsx` for direct execution.
No Jest, no Vitest. Run with: `node --import tsx --test "tools/**/*.test.ts"`

---

## What I found online

- Node.js `node:test` is now stable and recommended for pure TS projects with no framework.
  Dependency injection via function arguments (instead of module-level mocking) is the idiomatic pattern.
- For CLI/agent tools, the contract test pattern (spawn subprocess, feed stdin, assert stdout) is
  the gold standard — it tests the actual runtime boundary, not just the function.
- In 2025, the strongest test suites for LLM tool wrappers test the *output envelope* separately
  from the *business logic*: one layer for `tool.test.ts` (pure function), one for `process.test.ts`
  (executable contract via subprocess).

---

## Test audit

The existing test suite is strong. It follows Carl's principles almost exactly.

**What's working well:**
- `tool.test.ts` — mocks only at the network boundary via injected `fetchImpl`. No internal mocking.
- `process.test.ts` — spawns the actual subprocess and verifies stdin/stdout JSON envelope. This is the
  best possible contract test — it catches shim misconfiguration and envelope wrapping bugs.
- Error cases are named and distinct: `auth_error`, `rate_limit_error`, `external_error`, `validation`.
  Each has its own test. No catch-all handling.
- `raw-tools.test.ts` — parametric test that verifies every raw Apollo tool maps inputs to correct
  HTTP request shapes. Good third-party touch point coverage.
- Live smoke tests exist but are gated behind `RUN_LIVE_BRAVE_TESTS=1` — correct approach.
- `load-dotenv.test.ts` — tests the real filesystem behavior, not a mock.

**What's missing:**

| Gap | Severity | Notes |
|-----|----------|-------|
| `cli.ts` agent loop is completely untested | High | Turn dispatch, approval gate regex, `done_for_now` guard, max-turns cutoff |
| `DESTRUCTIVE_PATTERNS` gate in `cli.ts` is untested | High | The approval regex can silently stop blocking if a tool path changes |
| `instantly.campaign.create` + `instantly.campaign.activate` have no tests | High | These are the most consequential tools — no coverage |
| Apollo enrichment tools (`apollo.person.match`, `apollo.organization.bulkEnrich`) have no `process.test.ts` | Medium | Contract verified for web.search but not for these |
| `ask_human` custom tool has no tests | Medium | Human-in-loop gate — failure here silently blocks the workflow |
| `offer_campaign` workflow (upcoming) has no test plan yet | Medium | Should be specced before building |
| No `process.test.ts` for Instantly lead/campaign tools | Medium | Only `tool.test.ts` exists |

---

## Prioritized suggestions

### P0 — Do immediately

**1. Test the DESTRUCTIVE_PATTERNS approval gate (`cli.ts`)**

The gate is the only thing preventing the agent from silently mutating Instantly.
If a tool path changes, the regex stops matching and mutations go unblocked.

Test structure (add to `tools/lib/` or a new `cli.test.ts`):
```ts
test("approval gate fires for instantly.campaign.create tool path", () => {
  const bashCmd = "printf '{}' | workflows/offer_campaign/tools/instantly.campaign.create/run";
  assert.equal(matchesDestructivePattern(bashCmd), true);
});

test("approval gate does not fire for web.search", () => {
  assert.equal(matchesDestructivePattern("workflows/offer_campaign/tools/web.search/run"), false);
});
```
Extract `DESTRUCTIVE_PATTERNS` into a testable export from `cli.ts`.

**2. Add `tool.test.ts` for `instantly.campaign.create` and `instantly.campaign.activate`**

These are the highest-consequence tools. They currently have no tests.
Follow the pattern in `tools/instantly/lead/instantly.lead.add/tool.test.ts` exactly.
Minimum cases: happy path, 401 auth error, 429 rate limit, missing API key, invalid input.

---

### P1 — Do this sprint

**3. Add `process.test.ts` for `instantly.campaign.create` and `instantly.lead.add`**

`tool.test.ts` tests the function. `process.test.ts` tests that the shim invokes the function and
wraps the output in `{ ok, result }`. Copy the subprocess harness from
`tools/web/web.search/process.test.ts` — it's already reusable.

**4. Test the `offer_campaign` workflow README instructions (integration)**

When the `offer_campaign` workflow is built, add a test that runs the agent in a scripted session:
- Feed a pre-canned offer description over stdin
- Assert that `offer.md` is written to `artifacts/<run-id>/offer.md`
- Assert that `ask_human` is called at least once before the file is written

This is the ratchet test for the human-in-loop guarantee.

**5. Add `tool.test.ts` for Apollo enrichment tools**

`apollo.person.match`, `apollo.organization.bulkEnrich`, and `apollo.person.show` are used
in Phase 5 of the offer workflow. They currently have no unit tests — only the parametric
`raw-tools.test.ts` which verifies request shape but not response mapping.

---

### P2 — Good practices to adopt

**6. Shim contract tests for every new workflow tool**

Every new tool added to `workflows/offer_campaign/tools/` should have a `process.test.ts`.
Pattern: feed minimal valid JSON on stdin via `spawnSync`, assert `{ ok: true, result: {...} }` on stdout.
This is cheap to write and catches shim misconfiguration before a real session.

**7. Fixture format for agent session tests**

When testing multi-turn agent behavior (offer loop, ICP loop), use a fixture pattern:
```
tools/lib/fixtures/offer-loop-turn-1.json   ← canned user input
tools/lib/fixtures/offer-loop-turn-1-out.json ← expected agent behavior
```
Add a `version: 1` field from the start (see TODOS.md P2: versioned fixture format).

**8. Gate live API tests with a single env flag per provider**

Current: `RUN_LIVE_BRAVE_TESTS=1` for web.search.
Extend to: `RUN_LIVE_APOLLO_TESTS=1`, `RUN_LIVE_INSTANTLY_TESTS=1`.
These should never run in CI. They run locally before a new provider integration ships.

---

## Patterns to carry forward

```
tools/<provider>/<tool>/
  tool.ts          ← pure function, fetchImpl injected
  tool.test.ts     ← mock at network boundary only
  process.test.ts  ← subprocess harness, verifies JSON envelope
```

- Never mock internal functions. If a function is hard to inject, it's doing too much.
- Every error class gets its own `assert.rejects` test with the exact error type.
- `onError` mapping (error → `{ type, message }`) always has its own test separate from the throw.
- Live smoke tests always guarded by a specific env var. Never in CI.
