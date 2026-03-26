#!/usr/bin/env tsx
import { config } from "dotenv";
import { createCliTransport } from "./transports/cli.ts";
import { runRelay } from "./runtime/src/relay-runner.ts";

config({ path: new URL(".env.local", import.meta.url).pathname });

const message = process.argv.slice(2).join(" ").trim();

if (!message) {
  console.error("Usage: relay <message>");
  process.exit(1);
}

await runRelay(message, createCliTransport());
