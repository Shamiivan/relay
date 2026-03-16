import { anyApi as api } from "convex/server";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { Transport, TransportClients } from "./types.ts";

type TuiEnv = {
  CONVEX_URL: string;
};

type TuiWatchHandlers = {
  onEvents?: (events: Doc<"events">[]) => void;
  onToolCalls?: (toolCalls: Doc<"toolCalls">[]) => void;
  onRun?: (run: Doc<"runs"> | null) => void;
};

export class TuiTransport implements Transport<TuiEnv> {
  readonly id = "tui" as const;

  private clients: TransportClients | null = null;
  private readonly threadKey = `tui:${process.pid}`;
  private readonly userId = process.env.USER ?? "tui-user";

  async start(clients: TransportClients, _env: TuiEnv): Promise<void> {
    this.clients = clients;
  }

  async submit(message: string) {
    if (!this.clients) {
      throw new Error("TuiTransport.start must be called before submit.");
    }

    return await this.clients.convex.mutation(api.runs.create, {
      message,
      userId: this.userId,
      threadKey: this.threadKey,
      transport: this.id,
    });
  }

  watchRun(runId: Doc<"runs">["_id"], handlers: TuiWatchHandlers): () => void {
    if (!this.clients) {
      throw new Error("TuiTransport.start must be called before watchRun.");
    }

    const unsubs = [
      this.clients.convexSubscription.onUpdate(
        api.events.listByRun,
        { runId },
        (events) => handlers.onEvents?.(events),
      ),
      this.clients.convexSubscription.onUpdate(
        api.toolCalls.listByRun,
        { runId },
        (toolCalls) => handlers.onToolCalls?.(toolCalls),
      ),
      this.clients.convexSubscription.onUpdate(
        api.runs.get,
        { runId },
        (run) => handlers.onRun?.(run),
      ),
    ];

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }

  async stop(): Promise<void> {
    this.clients = null;
  }
}
