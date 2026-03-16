import { anyApi as api } from "convex/server";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { createLogger } from "../../logger/src/index.ts";
import type { Transport, TransportClients } from "./types.ts";

type DiscordEnv = {
  CONVEX_URL: string;
  DISCORD_TOKEN: string;
  LOG_LEVEL?: string;
};

export class DiscordTransport implements Transport<DiscordEnv> {
  readonly id = "discord" as const;

  private client: Client | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly deliveringRunIds = new Set<string>();

  async start({ convex, convexSubscription }: TransportClients, env: DiscordEnv): Promise<void> {
    const logger = createLogger({
      level: env.LOG_LEVEL,
      service: "bot",
    });

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });
    this.client = client;

    client.once(Events.ClientReady, (readyClient) => {
      logger.info("bot_started", { userTag: readyClient.user.tag });
    });

    this.unsubscribe = convexSubscription.onUpdate(
      api.runs.listDeliverable,
      { transport: this.id },
      async (runs) => {
        for (const run of runs) {
          if (this.deliveringRunIds.has(run._id)) {
            continue;
          }

          this.deliveringRunIds.add(run._id);
          try {
            const channelKey = run.threadKey ?? run.channelId;
            if (!channelKey) {
              throw new Error(`Run is missing thread key: ${run._id}`);
            }

            const channel = await client.channels.fetch(channelKey);
            if (!channel?.isTextBased() || !("send" in channel)) {
              throw new Error(`Channel is not text-based: ${channelKey}`);
            }

            const text =
              run.outcome === "success"
                ? run.outputText ?? "Run finished without output."
                : run.errorMessage ?? `Run failed: ${run.errorType ?? "unknown_error"}`;
            await channel.send(text);
            await convex.mutation(api.runs.markDelivered, { runId: run._id });
          } catch (error) {
            logger.error("run_delivery_failed", {
              error,
              runId: run._id,
              threadKey: run.threadKey ?? run.channelId,
            });
          } finally {
            this.deliveringRunIds.delete(run._id);
          }
        }
      },
    );

    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot || !message.content.trim()) {
        return;
      }

      await convex.mutation(api.runs.create, {
        message: message.content.trim(),
        userId: message.author.id,
        threadKey: message.channelId,
        transport: this.id,
      });
      await message.reply("Queued.");
    });

    await client.login(env.DISCORD_TOKEN);
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.client?.destroy();
    this.client = null;
  }
}
