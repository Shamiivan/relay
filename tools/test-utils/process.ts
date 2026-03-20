import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";

export function canSpawnSubprocesses(cwd: string): boolean {
  const probe = spawnSync(process.execPath, ["-e", ""], {
    cwd,
    encoding: "utf8",
  });
  if (!probe.error) {
    return true;
  }
  return !("code" in probe.error && probe.error.code === "EPERM");
}

export function runJsonTool(
  command: string,
  args: string[],
  input: unknown,
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
  },
): { stdout: string; stderr: string; exitCode: number | null } {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    input: `${JSON.stringify(input)}\n`,
  });

  if (result.error) {
    throw result.error;
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status,
  };
}

export async function createTempWorkflowShim(options: {
  repoRoot: string;
  toolPath: string;
  toolName: string;
}): Promise<{ shimPath: string; cwd: string }> {
  const sandboxRoot = await mkdtemp(path.join(tmpdir(), "relay-process-shim-"));
  const shimDir = path.join(sandboxRoot, "workflows", "test", "tools", options.toolName);
  const shimPath = path.join(shimDir, "run");

  await mkdir(shimDir, { recursive: true });
  await writeFile(
    shimPath,
    [
      "#!/usr/bin/env bash",
      `ROOT=${JSON.stringify(options.repoRoot)}`,
      `exec node --import "$ROOT/node_modules/tsx/dist/loader.mjs" ${JSON.stringify(options.toolPath)}`,
      "",
    ].join("\n"),
    "utf8",
  );
  await chmod(shimPath, 0o755);

  return {
    shimPath,
    cwd: sandboxRoot,
  };
}
