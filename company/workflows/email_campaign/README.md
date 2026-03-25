---
intent: email_campaign
description: Refine an offer, discover trigger-based segments, and draft a cold email campaign
fields: {}
---
Use `email_campaign` to help a human refine an offer, discover sensible trigger-based campaign segments, and draft a targeted outbound campaign before any sending happens.

This is a human-in-the-loop campaign manager workflow.

Campaign mindset:

- treat each sequence as one campaign for one narrow segment
- do not build one generic sequence for thousands of prospects
- prefer multiple small campaigns over one broad campaign
- a good segment usually has one persona, one trigger bucket, and one clear pain pattern
- one outbound campaign should sit on top of one ICP, even if the business has multiple ICPs overall
- once one segment is approved, write artifacts for that segment only; repeat the workflow later for the next segment

Relevancy over personalization:

- relevance beats novelty
- build campaigns around people who are likely to have the problem, not around random personal details
- do not use personalization unless it clearly strengthens the connection between the trigger, the pain, and the offer
- the goal is not "show me you know me"
- the goal is "show me you understand my situation"
- prioritize problem fit, trigger fit, persona fit, and timing before adding personalized hooks

Prospects and targeting:

- define the ICP before narrowing to the campaign segment
- keep ICP and persona separate:
  - ICP = the type of company
  - persona = the person inside that company who feels the pain
- the more precise the ICP is, the easier it is to find accounts where the offer is actually relevant
- use one campaign per ICP; if there are multiple ICPs, run this workflow again for each one
- use the campaign segment to narrow further within that ICP by trigger, pain pattern, and persona

Scope:

- start from a rough offer idea
- refine the pain point and offer framing
- use web search to discover likely trigger events and recent signals
- use Apollo to search for matching people and infer target accounts from those results
- loop with the human to qualify whether the segment is sensible
- write approved campaign artifacts
- draft a message theme and a 5-email sequence
- recommend basic sending settings for later use
- write workflow artifacts through workflow tools, not plain bash heredocs

Out of scope:

- autonomous campaign creation during the default discovery loop
- campaign activation
- autonomous sending

Artifacts:

- `research.md` must be created during discovery
- `icp.md` must be created after the user approves a sensible segment
- `offer.md` must be created during offer creation

Phase 0: company discovery

- use bash file reads to load `company/<name>/README.md` first
- prefer `cat` for short files and `sed -n` for targeted reads
- use that brief to understand what the company does, how it frames the problem, and who it serves
- if the company brief is missing or too thin, stop and ask for the missing context before drafting

Phase rule:

- use bash file reads to load only the current phase doc before acting
- do not skip to later work if the current artifact has not been written

Phases:

1. `phases/01_discovery.md`
2. `phases/02_offer_creation.md`

Core rules:

- optimize for relevancy, not generic personalization
- prefer relevant segment selection over clever personalized openers
- write short plain-text emails
- focus on one approved campaign segment at a time
- treat the segment, not the master ICP, as the unit of work
- still define the ICP clearly before narrowing into the segment
- work with the human in a multi-turn way during discovery; do not expect a perfect brief up front
- never suggest sending from the primary company domain
- do not perform any destructive tool action in this workflow version
- do not leave key outputs only in the chat response; write the artifact file
- rank trigger evidence by relevance and recency
- prefer recent company signals over generic static segmentation

Available workflow tools:

- `file.write` and `file.update` for `icp.md` and `offer.md`
- `web.search` and `web.fetch` for trigger and pain research
- `apollo.search_people` for account/persona discovery
- `instantly.account.search`, `instantly.campaign.create`, `instantly.campaign.update`, `instantly.lead.add`, and `instantly.campaign.activate` for later manual execution after the human approves the campaign settings

Default discovery loop:

1. rough offer idea from the human
2. refine the pain point and business result
3. search the web for trigger patterns and recent company signals
4. use `apollo.search_people` to find matching personas and target-account patterns
5. write `research.md`
6. review findings with the human
7. tighten or widen the segment
8. once approved, write `icp.md`
9. then draft `offer.md`

Segment examples:

- one persona + one trigger:
  - Operations Managers at service businesses that are actively hiring
- same offer, different trigger:
  - Operations Managers at service businesses that recently expanded locations
- same trigger, different persona:
  - Finance leaders at service businesses that are hiring into operations
