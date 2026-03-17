Use `gmail.search.poc` with raw Gmail search syntax in the `query` field.

You may also use this tool for broad inbox lookup tasks when the user has not given a precise Gmail query. In those cases, construct a reasonable default query yourself.

Examples for broad lookup:
- `my last email` -> use a broad query like `in:anywhere` and set `maxResults: 1`
- `my latest unread email` -> use `is:unread` and set `maxResults: 1`
- `find recent receipts from Anthropic` -> use a query like `anthropic receipt newer_than:90d`

Useful patterns:
- `from:person@example.com`
- `from:domain.com`
- `subject:"exact phrase"`
- `in:inbox`
- `newer_than:30d`
- free text like `receipt anthropic` or `invoice claude`

Search strategy:
- For broad requests, prefer a best-effort search first instead of asking for clarification.
- Only ask for clarification when the user needs identification beyond what a reasonable Gmail query can infer.
- For companies, try both brand-name queries and domain queries.
- If one search fails, try 2-4 alternate queries before concluding nothing exists.
- If the user is asking whether a message exists in the inbox, include `in:inbox`.
- For billing questions, combine vendor terms with `receipt`, `invoice`, `subscription`, or `payment`.
- Prefer narrow, concrete queries over broad ones when you already know the likely sender or subject.
