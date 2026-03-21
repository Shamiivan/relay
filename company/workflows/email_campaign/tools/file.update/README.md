---
intent: file.update
description: Replace exact text in an existing workflow artifact.
shared_tool: tools/file/file.update
mutates: true
destructive: false
fields:
  path: "string: Relative or absolute workspace path"
  oldText: "string: Exact text to replace"
  newText: "string: Replacement text"
returns:
  path: "string: Relative file path"
  replaced: "boolean: True when the replacement succeeds"
---

`file.update` exposes the shared file update tool inside the `email_campaign` workflow.

Use it when `icp.md` or `offer.md` already exists and needs a targeted update.

## Example

```bash
printf '%s\n' '{"path":"offer.md","oldText":"### Email 2: Subject: Re: billing workflow","newText":"### Email 2: Subject: billing timing"}' | company/workflows/email_campaign/tools/file.update/run
```
