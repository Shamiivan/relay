import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

test("bug_report workflow points discovery at the shared task and default destination", () => {
  const readme = read("../README.md");

  assert.match(readme, /write the bug report under `AGENTS\/bug_report`/);
  assert.match(readme, /default to creating a new bug report/);
  assert.match(readme, /do not ask whether to create a new bug report unless the user explicitly asks you to search, deduplicate, or check for an existing report first/);
  assert.match(readme, /run `list_bug_reports`/);
  assert.match(readme, /ask 2 or 3 short clarifying questions with `ask_human`/);
  assert.match(readme, /company\/workflows\/bug_report\/tools\/create_bug_report\/run/);
  assert.match(readme, /company\/workflows\/bug_report\/tools\/cancel\/run/);
  assert.match(readme, /company\/workflows\/bug_report\/tools\/list_bug_reports\/run/);
  assert.match(readme, /terminal\.status/);
  assert.match(readme, /terminal\.instruction/);
  assert.match(readme, /The next and only valid action is `done_for_now`/);
});
