import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { fileUpdateTool } from "./file.update/tool.ts";
import { fileWriteTool } from "./file.write/tool.ts";
import { FileToolError } from "./lib.ts";

test("file.write onError preserves explicit file error types", () => {
  assert.deepEqual(
    fileWriteTool.onError?.(new FileToolError("permission_denied", "no access", { path: "artifacts/a.md" })),
    { type: "permission_denied", message: "no access", path: "artifacts/a.md" },
  );
  assert.deepEqual(
    fileWriteTool.onError?.(new FileToolError("binary_not_supported", "binary", { path: "artifacts/a.md" })),
    { type: "binary_not_supported", message: "binary", path: "artifacts/a.md" },
  );
});

test("file.update onError preserves explicit semantic edit error types", () => {
  assert.deepEqual(
    fileUpdateTool.onError?.(new FileToolError("match_not_found", "missing", { path: "artifacts/b.md" })),
    { type: "match_not_found", message: "missing", path: "artifacts/b.md" },
  );
  assert.deepEqual(
    fileUpdateTool.onError?.(new FileToolError("match_not_unique", "many", { path: "artifacts/b.md" })),
    { type: "match_not_unique", message: "many", path: "artifacts/b.md" },
  );
  assert.deepEqual(
    fileUpdateTool.onError?.(new FileToolError("no_change", "same", { path: "artifacts/b.md" })),
    { type: "no_change", message: "same", path: "artifacts/b.md" },
  );
});

test("file tool onError still returns validation for zod failures", () => {
  const error = new z.ZodError([{
    code: "custom",
    path: ["path"],
    message: "bad path",
  }]);

  assert.deepEqual(fileWriteTool.onError?.(error), {
    type: "validation",
    message: "bad path",
  });
});
