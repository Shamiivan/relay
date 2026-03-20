---
intent: file.update
description: Replace exact text once in an existing local text file inside the workspace
fields:
  path: "string: Relative or absolute path inside the workspace"
  oldText: "string: Exact text to replace"
  newText: "string: Replacement text"
---
Update an existing local text file atomically with one exact replacement.

## Examples

```bash
printf '{"path":"artifacts/run-1/offer.md","oldText":"Draft","newText":"Approved"}' | workflows/sales_prospect_research/tools/file.update/run
```
