#!/usr/bin/env tsx
import { config } from "dotenv";
import { main } from "@mariozechner/pi-coding-agent";

config({ path: new URL(".env.local", import.meta.url).pathname });

await main(process.argv.slice(2));
