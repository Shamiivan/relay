import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { DiscordTransport } from "../../../packages/transport/src/discord.ts";
import { loadEnv } from "./env";

export async function startBot(): Promise<void> {
  const env = loadEnv();
  const convex = new ConvexHttpClient(env.CONVEX_URL);
  const convexSubscription = new ConvexClient(env.CONVEX_URL);
  const transport = new DiscordTransport();
  await transport.start({ convex, convexSubscription }, env);
}

void startBot();
