#!/usr/bin/env node
// Self-contained: reads JSON from stdin, writes JSON to stdout
// Task: find-reference-doc — turns user request into a Drive search plan

import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });
const lines = [];
rl.on("line", (l) => lines.push(l));
rl.on("close", () => {
  try {
    const input = JSON.parse(lines.join(""));
    const text = (input.userRequest || "").toLowerCase();
    const needsLatest =
      text.includes("latest") || text.includes("last") || text.includes("recent");

    const result = {
      query: "name contains 'board' and trashed = false",
      maxResults: needsLatest ? 5 : 10,
      rationale: needsLatest
        ? "Prefer a smaller recent board-related result set first."
        : "Use a broader board-related query to discover strong candidates.",
    };

    process.stdout.write(JSON.stringify({ ok: true, result }) + "\n");
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: { type: "internal_error", message: String(err) } }) + "\n");
  }
});
