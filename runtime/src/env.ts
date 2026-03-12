/**
 * Loads environment for local runtime processes.
 * Root values override the local Convex env when both are present.
 */
import dotenv from "dotenv";
import { z } from "zod";

function optionalNonEmptyString() {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().min(1).optional());
}

const envSchema = z.object({
  CONVEX_URL: z.string().url(),
  DISCORD_TOKEN: z.string().min(1).optional(),
  LOG_LEVEL: z.string().default("info"),
  TRACE_DIR: z.string().default(".relay/traces"),
  MODEL_PROVIDER: z.string().default("gemini"),
  MODEL_NAME: z.string().default("gemini-2.5-flash"),
  GEMINI_API_KEY: optionalNonEmptyString(),
  GOOGLE_API_KEY: optionalNonEmptyString(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REFRESH_TOKEN: z.string().min(1),
}).transform((env) => ({
  ...env,
  GEMINI_API_KEY: env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY ?? "",
}));

export function loadRuntimeEnv() {
  dotenv.config({ path: "convex/.env.local", quiet: true });
  dotenv.config({ path: ".env.local", override: true, quiet: true });
  return envSchema.parse(process.env);
}
