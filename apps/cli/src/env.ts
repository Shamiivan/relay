import { z } from "zod";
import { loadDotenv } from "../../../packages/env/src/index.ts";

const envSchema = z.object({
  CONVEX_URL: z.string().url(),
  LOG_LEVEL: z.string().default("info"),
});

export function loadEnv() {
  loadDotenv();
  return envSchema.parse(process.env);
}
