# Workflow Rules

- Prefer declared tool execution inside workflows. When a tool has a `tool.ts` declaration, import that declaration and call `ctx.tools.executeTool(declaredTool, input)` instead of using `ctx.tools.execute("tool.name", ...)`.
- Do not re-declare tool input or output types inside a workflow when the tool declaration already defines them. Let the tool declaration remain the single source of truth for typing.
- Avoid local wrapper helpers that only convert `ctx.tools.execute("tool.name", ...)` into a casted result shape. If a wrapper exists only for typing, replace it with direct declared-tool execution.
