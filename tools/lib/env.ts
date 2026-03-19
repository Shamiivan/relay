import { loadDotenv } from "../../packages/env/src/index.ts";

const REQUIRED_SALES_ENV_VARS = [
  "APOLLO_API_KEY",
  "INSTANTLY_API_KEY",
  "BRAVE_API_KEY",
] as const;

export type RequiredSalesEnvVar = (typeof REQUIRED_SALES_ENV_VARS)[number];

export function getMissingSalesEnvVars(
  env: NodeJS.ProcessEnv = process.env,
): RequiredSalesEnvVar[] {
  return REQUIRED_SALES_ENV_VARS.filter((name) => {
    const value = env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function validateSalesEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const missing = getMissingSalesEnvVars(env);

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `Missing required sales workflow environment variables: ${missing.join(", ")}. `
    + "Set them in .env.local or the process environment before running sales tools.",
  );
}

loadDotenv();
validateSalesEnv();
