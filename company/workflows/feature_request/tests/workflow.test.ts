import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

test("feature_request workflow points discovery at the shared task and default destination", () => {
  const readme = read("../README.md");

  assert.match(readme, /write the feature request under `AGENTS\/feature_requests`/);
  assert.match(readme, /default to creating a new feature request/);
  assert.match(readme, /do not ask whether to create a new feature request unless the user explicitly asks you to search, deduplicate, or check for an existing request first/);
  assert.match(readme, /run `list_feature_requests`/);
  assert.match(readme, /ask 2 or 3 short clarifying questions with `ask_human`/);
  assert.match(readme, /ask at most 3 clarifying questions before creation/);
  assert.match(readme, /generate `possible_tests` yourself from the request and clarifications/);
  assert.match(readme, /do not ask the user for `possible_tests` by default/);
  assert.match(readme, /company\/workflows\/feature_request\/tools\/create_feature_request\/run/);
  assert.match(readme, /company\/workflows\/feature_request\/tools\/cancel\/run/);
  assert.match(readme, /company\/workflows\/feature_request\/tools\/list_feature_requests\/run/);
  assert.match(readme, /terminal\.status/);
  assert.match(readme, /terminal\.instruction/);
  assert.match(readme, /The next and only valid action is `done_for_now`/);
});
