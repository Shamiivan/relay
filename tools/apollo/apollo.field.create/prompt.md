Create a field in Apollo using the native field creation endpoint.

Use this only after human approval, because it mutates external system state.

Arguments:
- `body`: native Apollo `fields/create` request body

Returns:
- `response`: raw Apollo JSON response from `POST /api/v1/fields/create`

Notes:
- This is an admin-style operation. Use it only when the user explicitly wants a new Apollo field created.

Example:
```json
{
  "body": {
    "name": "Agency Stage",
    "object_type": "contact",
    "field_type": "picklist"
  }
}
```

Use the exact native Apollo field-definition payload under `body`.
