/**
 * Loads environment for local runtime processes.
 * Root values override the local Convex env when both are present.
 */
import dotenv from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  CONVEX_URL: z.string().url(),
  DISCORD_TOKEN: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REFRESH_TOKEN: z.string().min(1),
});

export function loadRuntimeEnv() {
  dotenv.config({ path: "convex/.env.local", quiet: true });
  dotenv.config({ path: ".env.local", override: true, quiet: true });
  return envSchema.parse(process.env);
}
