import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import type { ThreadData } from "../thread.ts";

export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

async function collect(
  child: ReturnType<typeof spawn>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d: Buffer) => {
      stdout += String(d);
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

export async function runExecutable(dir: string, args: ThreadData): Promise<ThreadData> {
  const runPath = path.join(dir, "run");
  if (!existsSync(runPath)) {
    throw new ExecutionError(`No run script at ${runPath}`);
  }

  const child = spawn(runPath, [], { stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.write(JSON.stringify(args));
  child.stdin.end();

  const { stdout, stderr, code } = await collect(child);

  if (stderr) process.stderr.write(`[${path.basename(dir)}] ${stderr}\n`);
  if (code !== 0) throw new ExecutionError(`${path.basename(dir)} exited ${code}: ${stderr}`);

  try {
    return JSON.parse(stdout) as ThreadData;
  } catch {
    throw new ExecutionError(`${path.basename(dir)} returned invalid JSON: ${stdout}`);
  }
}
