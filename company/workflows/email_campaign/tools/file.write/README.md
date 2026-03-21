---
intent: file.write
description: Create or overwrite a workflow artifact file.
shared_tool: tools/file/file.write
mutates: true
destructive: false
fields:
  path: "string: Relative or absolute workspace path"
  content: "string: Full file contents"
  mode: "string: create, overwrite, or upsert"
returns:
  path: "string: Relative file path"
  created: "boolean: True when a new file is created"
---

`file.write` exposes the shared file write tool inside the `email_campaign` workflow.

Use it to write `icp.md`, `offer.md`, or other local workflow artifacts.

## Example

```bash
printf '%s\n' '{"path":"icp.md","content":"# ICP: Immediate Billing for Service Businesses\n\n- **Offer:** Immediate billing workflow redesign.\n- **Persona:** Operations Manager.\n","mode":"upsert"}' | company/workflows/email_campaign/tools/file.write/run
```
