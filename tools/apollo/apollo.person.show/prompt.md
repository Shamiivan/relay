Fetch a single Apollo person record by Apollo-native lookup arguments.

Use this for detailed person reads after search or matching.

Arguments:
- `id`: convenience alias for one Apollo person ID
- `body`: native Apollo `people/show` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/people/show`

Notes:
- If `id` alone does not work for a specific lookup, pass the exact Apollo-native show payload in `body`.
- Use this when you need full Apollo person detail rather than the normalized `apollo.search_people` output.

Example:
```json
{
  "id": "64a7ff0cc4dfae00013df1a5"
}
```

If Apollo requires a more specific lookup payload for your key tier, pass the native request under `body` instead.
