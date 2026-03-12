/**
 * Discord transport entry point for Relay.
 * Keep this file thin and delegate workflow to Convex.
 */
import { ConvexHttpClient } from "convex/browser";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { loadEnv } from "./env";

/**
 * Polls Convex until the scheduled run finishes or fails.
 * This keeps the bot simple until we add subscriptions or callbacks.
 */
async function waitForRunResult(
  client: ConvexHttpClient,
  runId: Id<"runs">,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const run = await client.query(api.runs.get, { runId });
    if (!run) {
      return "Run not found.";
    }

    if (run.status === "finished") {
      return run.outputText ?? "Run finished without output.";
    }

    if (run.status === "failed") {
      return run.errorMessage ?? `Run failed: ${run.errorType ?? "unknown_error"}`;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return "Run queued. Check Convex for the final result.";
}

/**
 * Starts the Discord client and bridges messages into Convex runs.
 * The bot does transport only and leaves agent work to the backend.
 */
export async function startBot(): Promise<void> {
  const env = loadEnv();
  const convex = new ConvexHttpClient(env.CONVEX_URL);
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Relay bot logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.trim()) {
      return;
    }

    const runId = await convex.mutation(api.runs.create, {
      message: message.content.trim(),
      userId: message.author.id,
      specialistId: "communication",
    });
    const outputText = await waitForRunResult(convex, runId);
    await message.reply(outputText);
  });

  await client.login(env.DISCORD_TOKEN);
}

void startBot();
