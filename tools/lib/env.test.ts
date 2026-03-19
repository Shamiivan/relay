import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const envModulePath = path.resolve(__dirname, "./env.ts");
const tsxLoaderPath = path.join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs");

test("env module fails with a clear missing-credential error", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "relay-env-test-"));
  writeFileSync(path.join(tempDir, ".env.local"), "", "utf8");
  writeFileSync(path.join(tempDir, ".env"), "", "utf8");

  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoaderPath, envModulePath],
    {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        APOLLO_API_KEY: "",
        INSTANTLY_API_KEY: "",
        BRAVE_API_KEY: "",
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required sales workflow environment variables:/);
  assert.match(result.stderr, /APOLLO_API_KEY/);
  assert.match(result.stderr, /INSTANTLY_API_KEY/);
  assert.match(result.stderr, /BRAVE_API_KEY/);
  assert.doesNotMatch(result.stderr, /401|unauthorized/i);
});
