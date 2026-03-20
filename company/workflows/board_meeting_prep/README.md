---
intent: board_meeting_prep
description: Prepare or revise board meeting documents using Google Drive and Docs
fields: {}
---
Use `board_meeting_prep` to find, read, copy, and revise board-meeting documents in Google Drive and Google Docs.

Available tools:
- `time.now` for current date and time
- `drive.search` for board-document discovery in Drive
- `drive.copy` for copying a source document into a working draft
- `docs.read` for reading a Google Doc as plain text
- `docs.write` for replacing a Google Doc body with revised text

Rules:
- Prefer the most recent strong board-related document as the reference when no explicit user preference is given.
- Keep concrete metadata attached to files: file name, mime type, modified time, and Drive link when available.
- When revising the working document, preserve the structure and tone of the current document unless the user explicitly asks for a structural change.
- Return plain text only from any generation step.
- Read the last 2 board meeting agendas and board meeting minutes to understand the context of the board meeting.
