# Phase 01: Discovery

Goal:

- refine a rough offer into one sensible trigger-based campaign segment

Read first:

- `company/<name>/README.md`
- `context/icp-template.md`
- `context/research-template.md`

Read method:

- use bash to read local files
- prefer `cat` for full short files
- use `sed -n` when only a relevant section is needed

Instructions:

1. Read the company brief and summarize the company, ICP, and solution framing back to yourself before asking questions.
2. Run discovery as a multi-turn conversation.
3. Start from the user's rough campaign idea and refine the offer first:
   - what workflow problem is being solved
   - what business result it creates
   - what pains or risks make the offer relevant
4. Use `company/workflows/email_campaign/tools/web.search/run` and `company/workflows/email_campaign/tools/web.fetch/run` to research:
   - pain-point language
   - trigger patterns
   - recent company signals
   - recency-sensitive evidence
5. Use `company/workflows/email_campaign/tools/apollo.search_people/run` to search for:
   - matching account-degree personas via titles, keywords, locations, and seniority filters
   - likely personas who feel the pain
6. Use `company/workflows/email_campaign/tools/file.write/run` to create or update `research.md` with the evidence gathered from web and Apollo before finalizing the segment.
7. Review the candidate segment with the human and tighten or widen it until it is sensible.
8. Keep the scope narrow: one approved offer, one ICP, one persona, one trigger bucket.
9. Use `company/workflows/email_campaign/tools/file.write/run` to create or update `icp.md` only after the human is happy with the segment.
10. Stop after both `research.md` and `icp.md` exist.

Output requirements:

- concise
- concrete
- enough detail to support relevant copy
- based on discovered evidence, not only assumptions
- `research.md` must use this structure:
  - `# Campaign Research`
  - `## Offer Hypothesis`
  - `## Pain Signals`
  - `## Trigger Signals`
  - `## Apollo Segment Notes`
  - `## Recommended Segment`

Suggested opening shape:

- "Let's create a campaign for <company>."
- briefly reflect the company framing from `company/<name>/README.md`
- propose an initial offer angle
- ask a small number of targeted questions about the offer
- then move into web and Apollo-based qualification

Do not:

- create campaigns
- activate anything
- skip writing `research.md`
- write `icp.md` before the human has approved the segment
