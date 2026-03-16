# Tool Declaration And Codegen

Relay should treat each tool as a declared contract plus a handwritten handler.
The declaration should be the source of truth for registration, model exposure, and typing.

## Goal

Make adding a tool cheap and low-risk:

1. add one declaration
2. implement the handler
3. run codegen

Everything else should be derived.

## Current Problem

Today a legacy tool like `drive.search` is repeated across several layers:

- `schema.json` declares model-facing parameters
- `run.ts` re-declares input validation
- specialist configs repeat the tool name as a string
- routines call the tool by raw string
- the runtime rescans the filesystem to rebuild tool metadata
- prompts live next to the tool but are loaded indirectly

This creates drift risk:

- declaration and runtime validation can diverge
- string names are easy to mistype
- tool registration is implicit filesystem behavior instead of compiled state

## Proposed Shape

Each new tool should have one canonical declaration file, for example:

`tools/gworkspace/drive/drive.search/tool.ts`

That file should declare metadata, prompt metadata, and the handwritten handler entrypoint.

Example shape:

```ts
import { z } from "zod";

export const driveSearchTool = defineTool({
  name: "drive.search",
  resource: "drive",
  capability: "search",
  description: "Search Google Drive files using Drive query syntax and return file metadata.",
  idempotent: true,
  input: z.object({
    query: z.string().min(1).describe(
      "The Google Drive search query to run, for example name contains 'invoice' and trashed = false.",
    ),
    maxResults: z.number().int().min(1).max(20).default(10).describe(
      "Maximum files to return, between 1 and 20.",
    ),
  }),
  output: z.object({
    files: z.array(z.object({
      id: z.string(),
      name: z.string(),
      mimeType: z.string(),
      webViewLink: z.string(),
      parents: z.array(z.string()),
      modifiedTime: z.string(),
      driveId: z.string(),
      owners: z.array(z.object({
        displayName: z.string(),
        emailAddress: z.string(),
      })),
    })).default([]),
    nextPageToken: z.string().optional(),
    error: toolErrorSchema.optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return await executeDriveSearch(input);
  },
});
```

Codegen should generate the thin runner wrapper from that declaration.

## Generated Artifacts

Codegen should produce a narrow set of checked outputs under:

`tools/_generated/`

Suggested outputs:

- `registry.ts`
  - exports all declared tools
  - exports `toolNames`
  - exports `getTool(name)`
- `model-tools.ts`
  - exports the exact `ModelTool[]` descriptors the worker sends to the model
- `prompts.ts`
  - exports prompt text by tool name
- `types.ts`
  - exports `ToolName`
  - exports per-tool input and output types
- `specialists.ts`
  - validates specialist tool lists against the known tool set

Optional output:

- JSON snapshots for inspection or debugging

## Runtime Integration

The worker should stop discovering tools from the filesystem at runtime.

Instead:

- import the generated registry
- filter tools by specialist config
- pass generated `ModelTool` declarations directly to the model layer
- load prompt text from generated prompt metadata

That means [runtime/src/tools.ts](/home/shami/workspaces/relay/runtime/src/tools.ts) should become thinner:

- process spawning
- handler execution
- maybe a few lookup helpers

It should not need to crawl the `tools/` tree on every run.

## Handler Pattern

Handlers should stay handwritten and typed from the declaration object itself.

`tool.ts` should own:

- contract
- prompt composition
- handler entrypoint
- deterministic error mapping

Generated code should own:

- runner wrapper
- registry wiring
- model descriptors

## Specialist Shape

Specialist config can stay machine-owned JSON, but codegen should validate tool names.

Current shape:

```json
{
  "id": "communication",
  "tools": ["drive.search", "drive.copy"]
}
```

That is fine, as long as:

- codegen fails on unknown tool names
- runtime does not discover missing names late

## Routine Shape

Routines should stop calling tools with string literals where possible.

Instead of:

```ts
await execute("drive.search", { query, maxResults });
```

Prefer:

```ts
await tools.execute(driveSearchTool, { query, maxResults });
```

or:

```ts
await executeTool(driveSearchTool, { query, maxResults });
```

That gives:

- typed input
- typed output
- less string drift
- easier refactors

## Minimal SDK Surface

Keep the local SDK small.

Suggested primitives:

- `defineTool()`
- `toolErrorSchema`
- `ToolDeclaration`
- `ToolHandler`
- `executeTool()`

Avoid building a large framework or DSL.
This should be a contract compiler, not a new platform.

## Migration Plan

Do this incrementally.

1. Add `defineTool()` and declaration support for one tool.
2. Generate a registry from declared tools.
3. Update the worker to use the generated registry.
4. Convert specialist validation to generated tool names.
5. Convert one routine to typed tool handles.
6. Migrate remaining tools one by one.
7. Remove runtime filesystem discovery after the last tool is migrated.

## Decision Rule

Generate what mirrors a contract:

- names
- metadata
- model-facing schemas
- TS types
- registry entries
- prompt lookup

Keep behavior handwritten:

- API calls
- auth logic
- result shaping where it is provider-specific
- routines
- agent loop

That keeps Relay simple while making the tool surface easier to grow.
