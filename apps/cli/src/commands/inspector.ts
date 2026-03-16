import { spawn } from "node:child_process";

export async function inspectorCommand(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pnpm", ["tsx", "apps/inspector/src/index.tsx"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Inspector exited with code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}
