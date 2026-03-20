# Instantly Campaign Search By Contact

Use this tool to find campaigns associated with a specific lead email address.

Use it when:
- you know the prospect email but not the campaign
- you need campaign membership lookup by contact

Arguments:
- `leadEmail` string email, required
- `limit` integer 1-100, default `10`
- `startingAfter` string cursor, optional

Returns:
- `campaigns`: array of normalized campaign objects
- `nextStartingAfter`: optional cursor

Examples:
```json
{"leadEmail":"ada@example.com","limit":10}
```

Typical use cases:
- determine which campaigns a prospect is in
- audit whether a lead was already added to an outreach motion
