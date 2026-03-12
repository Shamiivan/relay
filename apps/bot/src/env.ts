/**
 * Loads environment variables for the bot.
 * Relay reads the app env plus the local Convex env in this repo.
 */
import dotenv from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  CONVEX_URL: z.string().url(),
  DISCORD_TOKEN: z.string().min(1),
  LOG_LEVEL: z.string().default("info"),
});

/**
 * Loads the bot env from the repo root and local Convex project.
 * Root values override Convex values when both are present.
 */
export function loadEnv() {
  dotenv.config({ path: "convex/.env.local", quiet: true });
  dotenv.config({ path: ".env.local", override: true, quiet: true });
  return envSchema.parse(process.env);
}
