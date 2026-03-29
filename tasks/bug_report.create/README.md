---
intent: bug_report.create
description: Create a bug report markdown file under AGENTS/bug_report from structured fields.
fields:
  title: "string: Human-readable bug title"
  description: "string: What happened, including concrete symptoms or error messages"
  repro: "string: Minimal steps to reproduce the bug"
  expected: "string: Optional expected behavior"
  version: "string: Optional affected version, for example 0.49.0"
  date: "string: Optional YYYY-MM-DD override for the filename prefix"
returns:
  path: "string: Relative path to the created bug report markdown file"
  terminal: "object: Terminal workflow hint with status and next-step instruction"
---

It validates the structured bug report fields, renders the markdown itself, writes the file, and returns the written path plus a terminal instruction for the next step.
