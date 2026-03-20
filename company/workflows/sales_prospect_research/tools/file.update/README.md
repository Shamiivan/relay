---
intent: file.update
description: Update an existing local text file by replacing exact text once, with atomic writes.
shared_tool: tools/file/file.update
prompt_ref: tools/file/file.update/prompt.md
mutates: true
destructive: false
fields:
  path: "string: Relative or absolute path inside the workspace"
  oldText: "string: Exact text to replace"
  newText: "string: Replacement text"
returns:
  path: "string: Workspace-relative file path"
  resolvedPath: "string: Absolute path resolved inside the workspace"
  bytesWritten: "number: Number of bytes written"
  diff: "string: Unified diff when previous content existed"
  replaced: "boolean: True when exactly one replacement was applied"
---
`file.update` updates an existing local text file by replacing exact text once, with atomic writes.

Safety: mutates workspace files. Review target paths and content before running.

This workflow exposes the shared `tools/file/file.update` implementation; inputs and outputs are identical.

See `tools/file/file.update/prompt.md` for deeper examples and operating guidance.

## Example

```bash
printf '{"path":"artifacts/run-1/offer.md","oldText":"Draft","newText":"Approved"}' | company/workflows/sales_prospect_research/tools/file.update/run
```
