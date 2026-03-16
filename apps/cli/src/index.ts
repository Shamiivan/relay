#!/usr/bin/env tsx
import { runCli } from "./cli";

void runCli().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
