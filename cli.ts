#!/usr/bin/env tsx
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import { createCliTransport } from "./transports/cli.ts";
import { runRelay } from "./runtime/src/relay-runner.ts";
import { checkpointContext, listContexts, readContext } from "./runtime/src/context-store.ts";
import type { ThreadEvent } from "./runtime/src/thread.ts";

config({ path: new URL(".env.local", import.meta.url).pathname });

const [subcommand, ...rest] = process.argv.slice(2);

// relay list [--all]
if (subcommand === "list") {
  const showAll = rest.includes("--all");
  const sessions = listContexts(".contexts", showAll ? undefined : { status: "paused" });
  if (sessions.length === 0) {
    console.log("No paused sessions.");
  } else {
    const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
    console.log(`${pad("ID", 45)}  ${pad("WORKFLOW", 20)}  ${pad("SCOPE", 15)}  PENDING`);
    console.log(`${"-".repeat(45)}  ${"-".repeat(20)}  ${"-".repeat(15)}  ${"-".repeat(30)}`);
    for (const s of sessions) {
      console.log(
        `${pad(s.id, 45)}  ${pad(s.meta.workflow, 20)}  ${pad(s.meta.scope, 15)}  ${s.meta.pending.slice(0, 60)}`,
      );
    }
  }
  process.exit(0);
}

// relay fork <session-id>
if (subcommand === "fork") {
  const sessionId = rest[0];
  if (!sessionId) {
    console.error("Usage: relay fork <session-id>");
    process.exit(1);
  }
  const { meta, eventsJson, threadContent } = readContext(".contexts", sessionId);
  if (meta.status !== "paused") {
    console.error(`Can only fork paused sessions (${sessionId} is ${meta.status})`);
    process.exit(1);
  }
  const newMeta = {
    ...meta,
    status: "paused" as const,
    createdAt: new Date().toISOString(),
    forkedFrom: sessionId,
  };
  const newId = checkpointContext(".contexts", newMeta, eventsJson, threadContent);
  console.log(`Forked: ${newId}`);
  process.exit(0);
}

// relay resume <session-id>
if (subcommand === "resume") {
  const sessionId = rest[0];
  if (!sessionId) {
    console.error("Usage: relay resume <session-id>");
    process.exit(1);
  }
  const { meta, eventsJson } = readContext(".contexts", sessionId);
  const events = JSON.parse(eventsJson) as ThreadEvent[];

  // Show the pending question and collect the user's answer
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const humanResponse = (await rl.question(`${meta.pending}\n> `)).trim();
  rl.close();

  await runRelay(meta.pending, createCliTransport(), {
    resumedSession: { id: sessionId, events, meta, humanResponse },
  });
  process.exit(0);
}

const message = [subcommand, ...rest].filter(Boolean).join(" ").trim();

if (!message) {
  console.error("Usage:");
  console.error("  relay <message>          Run the agent with a message");
  console.error("  relay list [--all]       List paused sessions");
  console.error("  relay resume <id>        Resume a paused session");
  console.error("  relay fork <id>          Fork a paused session into a new branch");
  process.exit(1);
}

await runRelay(message, createCliTransport());
