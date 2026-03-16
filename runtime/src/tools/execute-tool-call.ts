import { spawn } from "node:child_process";
import type { ToolManifest } from "./tool-registry";

/**
 * Executes one command-backed tool and parses its JSON result.
 */
export async function executeToolCall(
  tool: ToolManifest,
  input: unknown,
): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    const child = spawn(tool.command[0], tool.command.slice(1), {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      const stdoutText = Buffer.concat(stdout).toString("utf8").trim();
      const stderrText = Buffer.concat(stderr).toString("utf8").trim();

      if (code !== 0) {
        reject(
          new Error(
            stderrText || `Tool ${tool.name} exited with status ${code ?? "unknown"}`,
          ),
        );
        return;
      }

      if (!stdoutText) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(stdoutText));
      } catch (error) {
        reject(
          new Error(
            `Tool ${tool.name} returned invalid JSON: ${
              error instanceof Error ? error.message : "Unknown parse error"
            }`,
          ),
        );
      }
    });

    child.stdin.end(JSON.stringify(input));
  });
}
