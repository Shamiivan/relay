#!/usr/bin/env tsx
import { Client, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
import { runRelay } from "../../../runtime/src/relay-runner.ts";
import { createDiscordTransport } from "../../../transports/discord.ts";

config({ path: new URL("../../../.env.local", import.meta.url).pathname });

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN is required. Add it to .env.local");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/** Global lock — one run at a time. A hung run will brick the bot until it exits.
 * Tool execution timeouts (TODOS P1) are needed to remove this risk. */
let running = false;

client.on("ready", () => {
  console.log(`Relay bot ready — logged in as ${client.user?.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (!client.user || !msg.mentions.has(client.user)) return;

  if (running) {
    await msg.reply("Agent is busy — try again shortly.").catch(() => { });
    return;
  }

  running = true;
  const userMessage = msg.content.replace(/<@!?\d+>/g, "").trim();

  if (!userMessage) {
    await msg.reply("What would you like me to do?").catch(() => { });
    running = false;
    return;
  }

  // Replies land in the same channel — no threading
  const transport = createDiscordTransport(msg.channel, msg.author.id);

  try {
    await runRelay(userMessage, transport);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await msg.channel.send(`Run failed: ${errorMessage}`).catch(() => { });
    console.error("Run error:", err);
  } finally {
    running = false;
  }
});

client.login(token);
