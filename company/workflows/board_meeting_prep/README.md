---
intent: board_meeting_prep
description: Prepare or revise board meeting documents using Google Drive and Docs
fields: {}
---
Use `board_meeting_prep` to find, read, copy, and revise board-meeting documents in Google Drive and Google Docs.

Phase 0: company discovery

- read the relevant company brief in `company/<name>/README.md` before searching for documents
- use the company brief to understand board context, current positioning, and any standing constraints
- if the company brief is missing or too thin, stop and ask for the missing context before drafting

## Tools from other workflows

### Time — use `manage_time`

Get the current date and day of the week before scheduling or referencing dates.

```bash
printf '{}' | company/workflows/manage_time/tools/time.now
```

### Drive — use `manage_drive`

- `drive.search` — find board documents by name or content
- `drive.copy` — copy a source document into a working draft
- `drive.upload` — upload a new file to Drive

```bash
printf '{"query":"name contains '\''board'\'' and trashed = false","maxResults":5}' | company/workflows/manage_drive/tools/drive.search/run
printf '{"fileId":"<id>","name":"Draft — Board Agenda May 2026"}' | company/workflows/manage_drive/tools/drive.copy/run
```

### Docs — use `manage_docs`

- `docs.read` — read a Google Doc as plain text
- `docs.write` — replace a Google Doc body with revised text

```bash
printf '{"documentId":"<id>"}' | company/workflows/manage_docs/tools/docs.read
printf '{"documentId":"<id>","text":"..."}' | company/workflows/manage_docs/tools/docs.write
```

## Pitfalls

**DO NOT** pass a plain search term to `drive.search`. It uses Drive query syntax.
- Wrong: `{"query":"board meeting agenda"}`
- Right: `{"query":"name contains 'board' and trashed = false","maxResults":5}`

**DO NOT** guess file IDs. Always `drive.search` first, then use the `id` from the result.

**DO NOT** call `docs.write` without reading the document first. You need to understand the current structure and tone before replacing content.

**DO NOT** skip `time.now`. Board prep references dates constantly — get the current date before mentioning "this week", "next meeting", etc.

**DO NOT** draft from scratch when a recent document exists. Search for the last 2 board meeting agendas and minutes first, then copy and revise.

## Self-improvement

After each run, reflect on what went well and what didn't:

1. Did the final document match the tone and structure of previous board documents? If not, read more prior documents next time before drafting.
2. Were dates accurate? If you guessed a date instead of calling `time.now`, fix that habit.
3. Did the user have to correct you on company context? If so, the company brief may need updating — suggest the user update `company/<name>/README.md`.
4. Did you make multiple search attempts? Tighten your Drive query syntax — use `name contains` with specific keywords and always add `trashed = false`.
5. Did the user ask for changes you could have anticipated from prior board docs? Next time read one more historical document.

## Rules

- Prefer the most recent strong board-related document as the reference when no explicit user preference is given.
- Keep concrete metadata attached to files: file name, mime type, modified time, and Drive link when available.
- When revising the working document, preserve the structure and tone of the current document unless the user explicitly asks for a structural change.
- Return plain text only from any generation step.
- Read the last 2 board meeting agendas and board meeting minutes to understand the context of the board meeting.
