# Phase 02: Offer Creation

Goal:

- turn the approved segment in `icp.md` into a usable draft sequence

Read first:

- `company/<name>/README.md`
- `icp.md`
- `context/copy-principles.md`
- `context/sequence-structure.md`

Read method:

- use bash to read local files
- prefer `cat` for full short files
- use `sed -n` when only a relevant section is needed

Instructions:

1. Build a short message theme section containing:
   - campaign name
   - persona
   - problem 1
   - risk 1
   - problem 2
   - risk 2
   - proof
2. Draft a 5-email sequence that follows `context/sequence-structure.md`.
3. Make the copy consistent with the company brief language. Reuse its framing where it improves clarity.
4. Keep the copy tied to the approved trigger and pain framing from discovery.
5. Keep the copy plain text and concise.
6. Add recommended campaign settings for later manual setup.
7. Use `company/workflows/email_campaign/tools/file.write/run` to create or update `offer.md` with the full result. Do not leave the sequence only in the chat response.
8. After writing the file, summarize what was written.

Output requirements:

- one message theme section
- five email drafts with subject lines
- recommended settings section
- use this exact top-level structure in `offer.md`:
  - `# Campaign Offer`
  - `## Message Theme`
  - `## Email Sequence`
  - `## Recommended Settings`

Writing rule:

- use a file edit to create or update `offer.md`
- if `offer.md` already exists, replace its contents with the latest approved draft

Do not:

- create a campaign
- send email
