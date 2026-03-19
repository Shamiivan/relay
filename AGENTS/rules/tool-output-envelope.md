# Tool Output Envelope

All tools return a result envelope — never inspect raw fields to determine success.

```ts
{ ok: true,  result: { ... } }   // success
{ ok: false, error: { type: string; message?: string } }  // failure
```

## Rules

- **Always check `ok` first.** Branch on `result.ok` before reading any fields.
- **`onError` returns `ToolErrorInfo`, not output shape.** Tool `onError` handlers return `{ type, message? }` only — `runDeclaredTool` wraps it into `{ ok: false, error }`.
- **Output schemas have no `error` field.** The envelope carries errors; individual tool output schemas contain only success data.
- **`find-reference-doc` and any manual stdio tools** must write `JSON.stringify({ ok: true, result })` or `JSON.stringify({ ok: false, error })` directly to stdout — never call `process.exit(1)` on error.

## Example

```ts
const raw = JSON.parse(await runTool("drive.search", input));
if (!raw.ok) {
  throw new Error(`drive.search failed: ${raw.error.type} — ${raw.error.message}`);
}
const files = raw.result.files;
```
