import { config as loadEnvFile } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

function findClosestEnvFile(startDir: string, filename: string): string | undefined {
  let currentDir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(currentDir, filename);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
}

export function loadDotenv(startDir: string = process.cwd()): void {
  const envLocalPath = findClosestEnvFile(startDir, ".env.local");
  if (envLocalPath) {
    loadEnvFile({ path: envLocalPath, override: true });
  }

  const envPath = findClosestEnvFile(startDir, ".env");
  if (envPath) {
    loadEnvFile({ path: envPath, override: false });
  }
}
