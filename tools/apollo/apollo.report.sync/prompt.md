Run Apollo report sync using the native report sync endpoint.

Use this for read-side reporting workflows or report refresh operations.

Arguments:
- `body`: native Apollo `reports/sync_report` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/reports/sync_report`

Notes:
- This is a raw utility wrapper. Use it when the user explicitly wants report sync behavior from Apollo.

Example:
```json
{
  "body": {
    "report_id": "report_123"
  }
}
```

Use the exact native Apollo report-sync payload under `body`.
