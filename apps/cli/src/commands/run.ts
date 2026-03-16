import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { CliTransport } from "../../../../packages/transport/src/cli.ts";
import { loadEnv } from "../env";

export async function runCommand(promptParts: string | string[] | undefined): Promise<void> {
  const prompt = Array.isArray(promptParts) ? promptParts.join(" ").trim() : promptParts?.trim();
  if (!prompt) {
    throw new Error("Prompt is required for one-shot execution.");
  }

  const env = loadEnv();
  const convex = new ConvexHttpClient(env.CONVEX_URL);
  const convexSubscription = new ConvexClient(env.CONVEX_URL);
  const transport = new CliTransport({ prompt });

  try {
    await transport.start({ convex, convexSubscription }, env);
  } finally {
    await transport.stop();
    convexSubscription.close();
  }
}
