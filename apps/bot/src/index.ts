/**
 * Discord transport entry point for Relay.
 * Keep this file thin and separate transport from execution.
 */
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { api } from "../../../convex/_generated/api";
import { createLogger } from "../../../packages/logger/src";
import { loadEnv } from "./env";

/**
 * Starts the Discord client and bridges messages into Convex runs.
 * The bot only enqueues runs and delivers terminal results.
 */
export async function startBot(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({
    level: env.LOG_LEVEL,
    service: "bot",
  });
  const convex = new ConvexHttpClient(env.CONVEX_URL);
  const convexSubscription = new ConvexClient(env.CONVEX_URL);
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info("bot_started", {
      userTag: readyClient.user.tag,
    });
  });

  const deliveringRunIds = new Set<string>();

  convexSubscription.onUpdate(api.runs.listDeliverable, {}, async (runs) => {
    for (const run of runs) {
      if (deliveringRunIds.has(run._id)) {
        continue;
      }

      const runLogger = logger.child({
        runId: run._id,
        channelId: run.channelId,
        userId: run.userId,
      });
      deliveringRunIds.add(run._id);

      try {
        if (!run.channelId) {
          throw new Error(`Run is missing channelId: ${run._id}`);
        }

        const channel = await client.channels.fetch(run.channelId);
        if (!channel?.isTextBased() || !("send" in channel)) {
          throw new Error(`Channel is not text-based: ${run.channelId}`);
        }

        const text =
          run.status === "finished"
            ? run.outputText ?? "Run finished without output."
            : run.errorMessage ?? `Run failed: ${run.errorType ?? "unknown_error"}`;

        runLogger.info("run_delivery_started", {
          status: run.status,
        });
        await channel.send(`<@${run.userId}> ${text}`);
        await convex.mutation(api.runs.markDelivered, { runId: run._id });
        runLogger.info("run_delivery_completed");
      } catch (error) {
        runLogger.error("run_delivery_failed", {
          error,
        });
      } finally {
        deliveringRunIds.delete(run._id);
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.trim()) {
      return;
    }

    const runId = await convex.mutation(api.runs.create, {
      message: message.content.trim(),
      userId: message.author.id,
      channelId: message.channelId,
      specialistId: "communication",
    });
    logger.info("run_enqueued", {
      runId,
      channelId: message.channelId,
      userId: message.author.id,
    });
    await message.reply("Queued.");
  });

  await client.login(env.DISCORD_TOKEN);
}

void startBot();
