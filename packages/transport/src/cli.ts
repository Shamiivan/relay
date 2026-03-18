import { anyApi as api } from "convex/server";
import type { Transport, TransportClients } from "./types.ts";

type CliTransportOptions = {
  prompt: string;
  threadKey?: string;
  userId?: string;
};

type CliEnv = {
  CONVEX_URL: string;
};

export class CliTransport implements Transport<CliEnv> {
  readonly id = "cli" as const;

  private readonly prompt: string;
  private readonly threadKey: string;
  private readonly userId: string;
  private unsubscribe: (() => void) | null = null;

  constructor(options: CliTransportOptions) {
    this.prompt = options.prompt;
    this.threadKey = options.threadKey ?? "cli-session";
    this.userId = options.userId ?? process.env.USER ?? "cli-user";
  }

  async start({ convex, convexSubscription }: TransportClients, _env: CliEnv): Promise<void> {
    const { runId } = await convex.mutation(api.runs.create, {
      message: this.prompt,
      userId: this.userId,
      threadKey: this.threadKey,
    });

    await new Promise<void>((resolve) => {
      this.unsubscribe = convexSubscription.onUpdate(
        api.runs.get,
        { runId },
        async (run) => {
          if (!run || run.status !== "done") {
            return;
          }

          const text =
            run.outcome === "success"
              ? run.outputText ?? "Run finished without output."
              : run.errorMessage ?? `Run failed: ${run.errorType ?? "unknown_error"}`;
          process.stdout.write(`${text}\n`);
          if (run.deliveryState !== "sent") {
            await convex.mutation(api.runs.markDelivered, { runId: run._id });
          }
          this.unsubscribe?.();
          this.unsubscribe = null;
          resolve();
        },
      );
    });
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
