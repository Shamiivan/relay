# Instantly Tool Boundary Testing

Date: 2026-03-19

## Working rule

For new Instantly tools, test the external boundary first. Do not only test the happy path. Before implementing each tool, enumerate plausible failures at the API boundary and add tests for those cases.

This follows the current tool pattern in the repo:
- pure tool/unit tests for normalization and error mapping
- process tests for the `{ ok, result | error }` stdio envelope

## Failures to design for

For each Instantly tool, explicitly consider:
- missing `INSTANTLY_API_KEY`
- fetch unavailable in runtime
- invalid tool input rejected by Zod
- `401` / `403` authentication failures
- `404` for resource lookup tools
- `429` rate limiting
- `5xx` upstream failures
- malformed or partial upstream JSON
- pagination/query param encoding mistakes
- endpoint-specific validation errors from Instantly

## Testing shape

Shared boundary tests:
- `tools/instantly/lib/client.test.ts`
- verifies Bearer auth header
- verifies base URL override
- verifies query parameter encoding
- verifies HTTP status to tool error mapping

Per-tool tests:
- `tool.test.ts` covers normalization, validation, and boundary failures
- `process.test.ts` verifies the executable contract used by workflow shims

## Current recommendation

When adding the first Instantly slice, start with one small read tool such as `instantly.campaign.search`, and fully test:
- success response normalization
- auth error mapping
- rate limit mapping
- malformed payload handling
- missing credential handling
- stdio envelope via process test

Only add more Instantly tools after this boundary pattern is stable.
