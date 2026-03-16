/**
 * Loads environment variables for the inspector.
 * Follows the same two-file pattern as apps/bot/src/env.ts.
 */
import { z } from "zod";
import { loadDotenv } from "../../../packages/env/src/index.ts";

const envSchema = z.object({
  CONVEX_URL: z.string().url(),
});

/**
 * Loads the inspector env from the repo root and local Convex project.
 * Root values override Convex values when both are present.
 */
export function loadEnv() {
  loadDotenv();
  return envSchema.parse(process.env);
}
