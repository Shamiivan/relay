import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../sdk";
import type { ToolErrorInfo } from "../../sdk";

const WORKSPACE_ROOT = path.resolve(process.cwd());
const STDOUT_LIMIT = 20_000;
const STDERR_LIMIT = 5_000;
const TIMEOUT_MS = 60_000;

export const bashTool = defineTool({
  name: "terminal.bash",
  resource: "terminal",
  capability: "read",
  description:
    "Run a bash command in the workspace and return stdout, stderr, and exit code. Supports pipes and shell syntax.",
  idempotent: false,
  input: z.object({
    command: z.string().min(1).describe(
      "Full bash command to run. Supports pipes, redirects, and shell built-ins.",
    ),
    cwd: z.string().optional().describe(
      "Working directory relative to workspace root. Defaults to workspace root.",
    ),
  }),
  output: z.object({
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number().int(),
    truncated: z.boolean().optional(),
    timedOut: z.boolean().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    let cwd = WORKSPACE_ROOT;
    if (input.cwd) {
      const resolved = path.resolve(WORKSPACE_ROOT, input.cwd);
      if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(WORKSPACE_ROOT + path.sep)) {
        throw new Error(`cwd must be within workspace root: ${WORKSPACE_ROOT}`);
      }
      cwd = resolved;
    }

    return new Promise((resolve) => {
      const child = spawn("bash", ["-lc", input.command], {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, TIMEOUT_MS);

      child.on("close", (code) => {
        clearTimeout(timer);
        let stdout = Buffer.concat(stdoutChunks).toString("utf8");
        let stderr = Buffer.concat(stderrChunks).toString("utf8");
        let truncated = false;

        if (stdout.length > STDOUT_LIMIT) {
          stdout = stdout.slice(0, STDOUT_LIMIT);
          truncated = true;
        }
        if (stderr.length > STDERR_LIMIT) {
          stderr = stderr.slice(0, STDERR_LIMIT);
          truncated = true;
        }

        resolve({
          stdout,
          stderr,
          exitCode: timedOut ? -1 : (code ?? -1),
          ...(truncated && { truncated: true }),
          ...(timedOut && { timedOut: true }),
        });
      });
    });
  },
  onError(error): ToolErrorInfo {
    return { type: "tool_error", message: error instanceof Error ? error.message : "Unknown error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(bashTool);
}
