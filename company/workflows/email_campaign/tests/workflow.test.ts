import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

test("email_campaign workflow requires research.md before icp.md", () => {
  const readme = read("../README.md");
  const discovery = read("../phases/01_discovery.md");

  assert.match(readme, /`research\.md` must be created during discovery/);
  assert.match(readme, /5\. write `research\.md`/);
  assert.match(discovery, /create or update `research\.md`/);
  assert.match(discovery, /Stop after both `research\.md` and `icp\.md` exist/);
});

test("email_campaign research template defines the required sections", () => {
  const template = read("../context/research-template.md");

  assert.match(template, /# Campaign Research/);
  assert.match(template, /## Offer Hypothesis/);
  assert.match(template, /## Pain Signals/);
  assert.match(template, /## Trigger Signals/);
  assert.match(template, /## Apollo Segment Notes/);
  assert.match(template, /## Recommended Segment/);
});
