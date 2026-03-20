---
status: ACTIVE
created: 2026-03-20
source-verified: 2026-03-20
---
# Spec: Human-In-The-Loop Offer To Campaign Workflow

## User Story

```text
As a founder running outbound
I want an agent to help me define an offer, research an ICP, find prospects, draft campaign copy, and prepare an Instantly campaign
So that I stay in control of strategy and approvals while the agent does the heavy lifting
```

---

## Core Product Decision

This workflow is not an autonomous sales bot.

It behaves like an operator copilot:

- the agent proposes
- the user reviews
- the user edits or redirects
- the agent only executes the next bounded step after approval

This should feel closer to Claude Code than to a background automation.

---

## Workflow Goal

Given an offer and user guidance, the system should:

1. help the user define the offer through back-and-forth discussion
2. convert the approved offer into a rough ICP
3. run broad web research on the ICP before prospect search
4. search Apollo directly from the ICP using company restrictions
5. enrich prospects and exclude risky contacts
6. run a second research pass for selected companies and people
7. generate personalized variables per lead
8. draft one campaign per offer in Instantly
9. upload leads only after approval
10. activate the campaign only after explicit approval

---

## Non-Goals

- fully autonomous campaign creation without user checkpoints
- syncing contacts or accounts into Apollo as a system of record
- multiple campaigns per run by default
- blasting unreviewed copy or unreviewed lead lists
- hiding intermediate files or decisions from the user

---

## Operating Model

### User Control

The user is in command all the way through.

The agent must stop after each phase and present:

- what it learned
- what artifact it produced
- what it wants to do next
- what approval is needed

### Approval Gates

Approval is required before:

- locking the offer
- running Apollo search
- running Apollo enrichment on shortlisted leads
- locking the sequence copy
- creating the Instantly campaign
- uploading leads to Instantly
- activating the campaign

### Default Safety Rules

- risky Apollo contacts are excluded by default
- Instantly activation is always explicit, never implied
- one offer maps to one campaign
- personalization is per lead through variables
- all important outputs are written locally as inspectable files

---

## Canonical Flow

### Phase 1: Offer Definition Loop

Goal:
Turn a vague sales idea into an approved offer brief.

Agent behavior:

- ask targeted questions about the offer
- pressure test ambiguity
- draft a normalized offer brief
- revise until the user explicitly approves

Questions should cover:

- what is being sold
- who it is for
- promised outcome
- why now
- proof or credibility
- exclusions and bad-fit customers
- constraints on tone, claims, and risk

Primary artifact:

- `artifacts/<run-id>/offer.md`

Exit condition:

- user explicitly approves the offer brief

### Phase 2: Rough ICP Definition Loop

Goal:
Convert the approved offer into a usable targeting hypothesis.

Agent behavior:

- propose a rough ICP
- convert the ICP into concrete search constraints
- let the user narrow or widen targeting before search runs

Targeting should support:

- direct people search from the ICP
- company restrictions such as employee count under 50
- geography, industry, title, seniority, and keyword constraints

Primary artifacts:

- `artifacts/<run-id>/icp.md`
- `artifacts/<run-id>/apollo-search-plan.json`

Exit condition:

- user approves the rough ICP and Apollo search plan

### Phase 3: Broad ICP Web Research

Goal:
Understand how the market talks about the ICP's pain points before prospecting.

Agent behavior:

- research the segment broadly
- identify repeated pain points, triggers, objections, and desired outcomes
- propose messaging angles grounded in the research

Research focus:

- pain point language
- urgency triggers
- status quo alternatives
- likely buying moments
- vocabulary the ICP already uses

Primary artifact:

- `artifacts/<run-id>/research/icp-summary.md`

Exit condition:

- user approves the positioning and research direction for prospecting

### Phase 4: Apollo Prospect Search

Goal:
Find prospects directly from the ICP while preserving company restrictions.

Agent behavior:

- run Apollo people search from the approved ICP
- include company-level constraints in the search strategy
- present a shortlist and explain why these prospects match

Notes:

- this is direct prospect search from the ICP, not account-first prospecting
- company restrictions remain part of the search logic

Primary artifacts:

- `artifacts/<run-id>/apollo-raw-people.json`
- `artifacts/<run-id>/shortlist-pre-enrichment.csv`

Exit condition:

- user approves whether to proceed with enrichment on the shortlist

### Phase 5: Apollo Enrichment And Risk Filtering

Goal:
Resolve selected people into usable outreach records with valid email data.

Agent behavior:

- enrich or match shortlisted prospects
- exclude risky contacts by default
- keep only outreach-ready leads

Notes:

- Apollo people search alone is not sufficient for final outreach data
- risky contacts should not proceed unless the user later changes policy

Primary artifacts:

- `artifacts/<run-id>/leads-enriched.json`
- `artifacts/<run-id>/leads-approved.csv`

Exit condition:

- user approves the cleaned lead set for deeper research

### Phase 6: Specific Company And Person Research

Goal:
Gather enough context to personalize at the lead level.

Agent behavior:

- run a second research pass on each selected company and person
- capture concrete observations that can power personalization
- avoid generic personalization fluff

Research targets:

- company website
- product pages
- hiring pages
- launches or announcements
- founder and team pages
- person role context where available

Primary artifacts:

- `artifacts/<run-id>/research/accounts/<company>.md`
- `artifacts/<run-id>/research/people/<person>.md`
- `artifacts/<run-id>/personalization-variables.json`

Exit condition:

- user approves the personalization quality bar

### Phase 7: Sequence Drafting Loop

Goal:
Draft one sequence for the offer and map lead-level variables into that sequence.

Agent behavior:

- write campaign copy from the approved offer and research
- use variables for personalization rather than bespoke full emails per lead
- revise until the user approves

Recommended starting point:

- one offer
- one campaign
- one sequence
- two steps

Primary artifacts:

- `artifacts/<run-id>/sequence.md`
- `artifacts/<run-id>/campaign-draft.json`

Exit condition:

- user explicitly approves the final campaign copy

### Phase 8: Instantly Campaign Creation

Goal:
Create the campaign in Instantly using the approved copy and sending configuration.

Agent behavior:

- create the campaign only after explicit approval
- persist the created campaign metadata locally
- do not activate yet

Primary artifacts:

- `artifacts/<run-id>/campaign-created.json`

Exit condition:

- campaign exists in Instantly and user approves moving to lead upload

### Phase 9: Lead Upload

Goal:
Upload the approved leads and variables into the created Instantly campaign.

Agent behavior:

- upload leads only after explicit approval
- include personalization variables
- report partial failures clearly

Primary artifacts:

- `artifacts/<run-id>/lead-upload-result.json`

Exit condition:

- leads are uploaded and user approves activation or pause state

### Phase 10: Campaign Activation

Goal:
Make the campaign live only if the user explicitly wants that.

Agent behavior:

- summarize what will go live
- require explicit activation approval
- activate only after approval

Primary artifact:

- `artifacts/<run-id>/activation-result.json`

Exit condition:

- campaign is active, or remains draft/paused by user choice

---

## Artifact Contract

All significant workflow state should be inspectable on disk.

Suggested layout:

```text
artifacts/<run-id>/
  offer.md
  icp.md
  apollo-search-plan.json
  apollo-raw-people.json
  shortlist-pre-enrichment.csv
  leads-enriched.json
  leads-approved.csv
  sequence.md
  campaign-draft.json
  campaign-created.json
  lead-upload-result.json
  activation-result.json
  research/
    icp-summary.md
    accounts/
    people/
```

Required lead-level fields:

- `firstName`
- `lastName`
- `email`
- `companyName`
- `title`
- `companyDomain`
- `painPoint`
- `trigger`
- `personalization`
- `subjectLine`
- `openingLine`
- `cta`

Preferred export formats:

- JSON for full fidelity
- CSV for quick review and manual editing

---

## Tooling Implications

### Existing Tools To Reuse

- `web.search`
- Apollo people and organization search tools
- Apollo person match or bulk match tools
- Instantly campaign lifecycle tools
- Instantly lead add

### Additional Workflow Capability Needed

The missing layer is orchestration plus local artifact writing.

Likely additions:

- a local file-writing helper for JSON, CSV, and Markdown artifacts
- a workflow task that advances phase by phase instead of trying to do everything in one jump
- explicit approval-aware workflow instructions in the workflow README

### Important External Constraints

- Apollo people search is discovery, not final contact resolution
- Apollo enrichment or matching is required for outreach-ready leads
- risky contacts should be filtered out before downstream work
- Instantly campaign copy lives in campaign `sequences`
- Instantly activation should remain separate from campaign creation

---

## Interaction Spec

### Conversation Style

The workflow should use short, practical prompts.

The agent should ask one focused question at a time when the user needs to decide something.

The agent should not ask broad open-ended questions if it can propose a draft first.

### Phase Handoffs

At the end of each phase, the agent should present:

1. what it produced
2. the main decisions or assumptions
3. the exact next action
4. the approval needed

### Failure Mode

If results are weak, the workflow should step back rather than push forward blindly.

Examples:

- if the offer is unclear, stay in the offer loop
- if Apollo returns weak matches, revise the ICP
- if personalization is thin, do more specific research
- if copy is weak, revise sequence before any Instantly mutation

---

## Recommended Defaults

- one campaign per offer
- direct people search from the ICP
- company restrictions preserved in targeting
- broad research before Apollo
- specific research after Apollo shortlist
- risky contacts excluded by default
- per-lead personalization through variables
- activation always manual
- store both JSON and CSV where useful
- start with a two-step sequence
- first implementation should cap runs at 25 approved leads

---

## Implementation Slices

### Slice 1: Offer And ICP Approval Loops

User value:
The agent can help define the offer and ICP without touching external systems.

Deliverables:

- workflow prompts for offer and ICP loops
- local artifact writing for `offer.md`, `icp.md`, and `apollo-search-plan.json`

Done when:

- a user can complete offer and ICP approval loops and inspect the output on disk

### Slice 2: Broad Research Before Apollo

User value:
The agent can ground targeting and messaging in actual ICP research before prospect search.

Deliverables:

- broad research phase using `web.search`
- `research/icp-summary.md`

Done when:

- a user can approve or redirect messaging based on a written ICP research summary

### Slice 3: Apollo Search Plus User-Approved Enrichment

User value:
The agent can find prospects from the ICP, then enrich only after approval.

Deliverables:

- Apollo direct people search flow
- shortlist artifact generation
- enrichment and risky-contact filtering

Done when:

- a user can inspect a shortlist, approve enrichment, and receive a clean lead file

### Slice 4: Specific Research And Personalization Variables

User value:
The agent can produce lead-level personalization with concrete evidence.

Deliverables:

- company and person research artifacts
- `personalization-variables.json`

Done when:

- a user can review lead-level research and variable quality before copy is drafted

### Slice 5: Sequence Drafting And Approval

User value:
The agent can draft the campaign sequence with variables and stop for approval.

Deliverables:

- `sequence.md`
- `campaign-draft.json`

Done when:

- a user can revise and approve final copy without any Instantly mutation yet

### Slice 6: Instantly Create, Upload, Activate With Separate Gates

User value:
The workflow can execute the real outbound setup while preserving user control.

Deliverables:

- campaign creation after approval
- lead upload after approval
- activation after approval
- result artifacts written to disk

Done when:

- the user can create a real campaign, upload leads, and explicitly choose whether to activate it

---

## Open Questions

- whether approval should be enforced purely by CLI destructive gating or also by workflow state logic
- whether person research should be mandatory for every lead or only for a scored subset
- whether the first implementation should support resume state across sessions
- whether the workflow should default to CSV review before upload even when JSON is available

---

## Success Criteria

This spec is successful when:

- the workflow feels collaborative rather than autonomous
- the user can inspect every important intermediate output locally
- the workflow never mutates Instantly without explicit approval
- the user can intervene and redirect strategy at any phase
- the workflow produces one coherent campaign per offer rather than scattered output
