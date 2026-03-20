---
intent: file.write
description: Create, overwrite, or upsert a local text file inside the workspace with atomic writes.
shared_tool: tools/file/file.write
prompt_ref: tools/file/file.write/prompt.md
mutates: true
destructive: false
fields:
  path: "string: Relative or absolute path inside the workspace"
  content: "string: Full text to write"
  mode: "string: create, overwrite, or upsert (default upsert)"
returns:
  path: "string: Workspace-relative file path"
  resolvedPath: "string: Absolute path resolved inside the workspace"
  mode: "string: Write mode that was executed"
  created: "boolean: True when a new file was created"
  bytesWritten: "number: Number of bytes written"
  diff: "string: Unified diff when previous content existed"
---
`file.write` creates, overwrites, or upserts a local text file inside the workspace with atomic writes.

Safety: mutates workspace files. Review target paths and content before running.

This workflow exposes the shared `tools/file/file.write` implementation; inputs and outputs are identical.

See `tools/file/file.write/prompt.md` for deeper examples and operating guidance.

## Example

```bash
printf '{"path":"artifacts/run-1/offer.md","content":"# Offer\n","mode":"create"}' | workflows/sales_prospect_research/tools/file.write/run
```
