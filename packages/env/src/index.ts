import { config as loadEnvFile } from "dotenv";

export function loadDotenv(): void {
  loadEnvFile({ path: ".env.local", override: true });
  loadEnvFile({ path: ".env", override: false });
}
