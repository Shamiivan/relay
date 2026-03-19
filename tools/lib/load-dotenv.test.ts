import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadDotenv } from "../../packages/env/src/index.ts";

test("loadDotenv finds .env.local from a nested working directory", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "relay-dotenv-test-"));
  const repoRoot = path.join(tempDir, "repo");
  const nestedDir = path.join(repoRoot, "tools", "web", "web.search");

  mkdirSync(nestedDir, { recursive: true });
  writeFileSync(path.join(repoRoot, ".env.local"), "BRAVE_API_KEY=from-dotenv-local\n", "utf8");

  const previousValue = process.env.BRAVE_API_KEY;
  delete process.env.BRAVE_API_KEY;

  try {
    loadDotenv(nestedDir);
    assert.equal(process.env.BRAVE_API_KEY, "from-dotenv-local");
  } finally {
    if (previousValue === undefined) {
      delete process.env.BRAVE_API_KEY;
    } else {
      process.env.BRAVE_API_KEY = previousValue;
    }
  }
});
