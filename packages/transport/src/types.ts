import type { ConvexClient, ConvexHttpClient } from "convex/browser";

export type TransportId = "discord" | "cli" | "tui";

export type TransportClients = {
  convex: ConvexHttpClient;
  convexSubscription: ConvexClient;
};

export interface Transport<TEnv = unknown> {
  readonly id: TransportId;
  start(clients: TransportClients, env: TEnv): Promise<void>;
  stop(): Promise<void>;
}
