/**
 * Inspector entry point.
 * Loads environment, opens a Convex WebSocket connection, and renders the Ink app.
 */
import React from "react";
import { render } from "ink";
import { ConvexClient } from "convex/browser";
import { loadEnv } from "./env";
import App from "./App";

const env = loadEnv();
const client = new ConvexClient(env.CONVEX_URL);
const { waitUntilExit } = render(<App client={client} />);

waitUntilExit().then(() => {
  client.close();
  process.exit(0);
});
