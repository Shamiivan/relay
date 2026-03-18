#!/usr/bin/env tsx
import { config } from "dotenv";
import { main } from "./pi-mono/packages/coding-agent/src/index.ts";

config({ path: new URL(".env.local", import.meta.url).pathname });

await main(process.argv.slice(2));
