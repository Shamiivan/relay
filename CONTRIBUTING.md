# Contributing

Thanks for working on Relay. This repo is easiest to change when docs, workflow instructions, and tests move together.

## Local Setup

```bash
pnpm install
cp .env.example .env.local
```

Add only the credentials needed for the workflow you are testing.

## Development Loop

```bash
pnpm check
pnpm test
```

Run both before opening a pull request. If an integration test needs external credentials, document what was skipped and why in the PR.

## Adding Tools

1. Add the typed tool under `tools/<provider>/<tool.name>/tool.ts`.
2. Use `defineTool()` and `runDeclaredTool()` from `tools/sdk.ts`.
3. Add prompt guidance beside the tool when the agent needs usage rules.
4. Expose the tool through the relevant workflow under `company/workflows/<workflow>/tools/`.
5. Document the workflow behavior in `company/workflows/<workflow>/README.md`.
6. Add focused tests for parsing, success responses, and expected error responses.

Tools must read JSON from stdin and return typed JSON to stdout:

```json
{ "ok": true, "result": { } }
{ "ok": false, "error": { "type": "error_type", "message": "Human readable detail" } }
```

## Documentation Standards

- Keep README commands in sync with `package.json`.
- Keep workflow READMEs specific enough for an agent to run the workflow without guessing.
- Do not document credentials, private customer data, or production secrets.
- Update `.env.example` when a new environment variable is required.

## Pull Requests

Use the PR template and include:

- what changed
- why it changed
- commands run
- any credentials, services, or manual checks needed to verify the change

Do not mix unrelated workflow rewrites, dependency churn, and documentation changes in the same PR unless they are required for one outcome.
