---
intent: file.write
description: Create, overwrite, or upsert a local text file inside the workspace
fields:
  path: "string: Relative or absolute path inside the workspace"
  content: "string: Full text to write"
  mode: "string: create, overwrite, or upsert (default upsert)"
---
Write a local text file atomically.

## Examples

```bash
printf '{"path":"artifacts/run-1/offer.md","content":"# Offer\n","mode":"create"}' | workflows/sales_prospect_research/tools/file.write/run
printf '{"path":"artifacts/run-1/sequence.md","content":"Step 1\n","mode":"upsert"}' | workflows/sales_prospect_research/tools/file.write/run
```
