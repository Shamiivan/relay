import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { TuiTransport } from "../../../../packages/transport/src/tui.ts";
import { loadEnv } from "../env";
import { runInteractiveShell } from "../tui/interactive";

export async function tuiCommand(): Promise<void> {
  const env = loadEnv();
  const convex = new ConvexHttpClient(env.CONVEX_URL);
  const convexSubscription = new ConvexClient(env.CONVEX_URL);
  const transport = new TuiTransport();

  try {
    await transport.start({ convex, convexSubscription }, env);
    await runInteractiveShell(transport);
  } finally {
    await transport.stop();
    convexSubscription.close();
  }
}
