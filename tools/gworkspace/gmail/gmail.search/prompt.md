Use `gmail.search` with raw Gmail search syntax in the `query` field.

Useful patterns:
- `from:person@example.com`
- `from:domain.com`
- `subject:"exact phrase"`
- `in:inbox`
- `newer_than:30d`
- free text like `receipt anthropic` or `invoice claude`

Search strategy:
- For companies, try both brand-name queries and domain queries.
- If one search fails, try 2-4 alternate queries before concluding nothing exists.
- If the user is asking whether a message exists in the inbox, include `in:inbox`.
- For billing questions, combine vendor terms with `receipt`, `invoice`, `subscription`, or `payment`.
- Prefer narrow, concrete queries over broad ones when you already know the likely sender or subject.
