#!/usr/bin/env -S node --import tsx
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import { createCliTransport } from "./transports/cli.ts";
import { createTuiTransport, shouldUseTui, TuiTransport } from "./transports/tui.ts";
import { runRelay } from "./runtime/src/relay-runner.ts";
import { checkpointContext, listContexts, readContext } from "./runtime/src/context-store.ts";
import type { ThreadEvent } from "./runtime/src/thread.ts";

config({ path: new URL(".env.local", import.meta.url).pathname, quiet: true });

const [subcommand, ...rest] = process.argv.slice(2);

// relay list [--all]
if (subcommand === "list") {
  const showAll = rest.includes("--all");
  const sessions = showAll
    ? [
        ...listContexts(".contexts", "in_progress"),
        ...listContexts(".contexts", "paused"),
        ...listContexts(".contexts", "done"),
      ]
    : listContexts(".contexts", "paused");

  if (sessions.length === 0) {
    console.log("No paused sessions.");
  } else {
    const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
    console.log(`${pad("ID", 45)}  ${pad("WORKFLOW", 20)}  ${pad("STATUS", 12)}  AWAITING`);
    console.log(`${"-".repeat(45)}  ${"-".repeat(20)}  ${"-".repeat(12)}  ${"-".repeat(40)}`);
    for (const s of sessions) {
      const awaiting = s.meta.handoff?.awaiting ?? "-";
      console.log(
        `${pad(s.id, 45)}  ${pad(s.meta.workflow, 20)}  ${pad(s.status, 12)}  ${awaiting.slice(0, 60)}`,
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
  const { meta, eventsJson, status } = readContext(".contexts", sessionId);
  if (status !== "paused") {
    console.error(`Can only fork paused sessions (${sessionId} is ${status})`);
    process.exit(1);
  }
  const now = new Date().toISOString();
  const newMeta = {
    ...meta,
    id: `${meta.workflow}__${now.replace(/:/g, "-")}`,
    createdAt: now,
    updatedAt: now,
    forkedFrom: sessionId,
  };
  const newId = checkpointContext(".contexts", newMeta, eventsJson);
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

  const awaiting = meta.handoff?.awaiting ?? "What would you like to do next?";
  const transport = shouldUseTui() ? createTuiTransport() : createCliTransport();
  try {
    const humanResponse = transport instanceof TuiTransport
      ? await (async () => {
          transport.preloadHistory(events);
          await transport.publishEvent({
            type: "request_human_clarification",
            data: { prompt: awaiting },
          });
          return transport.promptForClarification(awaiting);
        })()
      : await (async () => {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          try {
            return (await rl.question(`${awaiting}\n> `)).trim();
          } finally {
            rl.close();
          }
        })();

    await runRelay(awaiting, transport, {
      resumedSession: { id: sessionId, events, meta, humanResponse },
    });
    process.exit(0);
  } finally {
    if (transport instanceof TuiTransport && !transport.isClosed()) {
      await transport.close();
    }
  }
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

const transport = shouldUseTui() ? createTuiTransport() : createCliTransport();
try {
  await runRelay(message, transport);
} finally {
  if (transport instanceof TuiTransport && !transport.isClosed()) {
    await transport.close();
  }
}
