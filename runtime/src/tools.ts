/**
 * Discovers command-backed tools from the local filesystem and executes them.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";

function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

const toolSchemaFileSchema = z.object({
  description: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
});

const toolManifestSchema = toolSchemaFileSchema.extend({
  name: z.string().min(1),
  command: z.array(z.string().min(1)).min(1),
});

export type ToolManifest = z.infer<typeof toolManifestSchema>;

export async function loadAllToolManifests(): Promise<ToolManifest[]> {
  const entries = await fs.readdir(repoPath("tools"), { withFileTypes: true });
  const manifests: ToolManifest[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const schemaPath = repoPath(path.join("tools", entry.name, "schema.json"));
    const runPath = repoPath(path.join("tools", entry.name, "run.ts"));
    const hasSchema = await fs
      .access(schemaPath)
      .then(() => true)
      .catch(() => false);
    const hasRun = await fs
      .access(runPath)
      .then(() => true)
      .catch(() => false);

    if (!hasSchema || !hasRun) {
      continue;
    }

    const raw = await fs.readFile(schemaPath, "utf8");
    const schemaFile = toolSchemaFileSchema.parse(JSON.parse(raw));

    manifests.push(
      toolManifestSchema.parse({
        name: entry.name,
        description: schemaFile.description,
        parameters: schemaFile.parameters,
        command: ["pnpm", "tsx", path.join("tools", entry.name, "run.ts")],
      }),
    );
  }

  return manifests.sort((left, right) => left.name.localeCompare(right.name));
}

export function getAllowedTools(
  toolNames: string[],
  manifests: ToolManifest[],
): ToolManifest[] {
  const manifestsByName = new Map(
    manifests.map((manifest) => [manifest.name, manifest] as const),
  );

  return toolNames.map((toolName) => {
    const manifest = manifestsByName.get(toolName);
    if (!manifest) {
      throw new Error(`Unknown tool in specialist config: ${toolName}`);
    }

    return manifest;
  });
}

export async function loadToolPrompt(toolName: string): Promise<string> {
  const promptPath = repoPath(path.join("tools", toolName, "prompt.md"));
  const hasPrompt = await fs
    .access(promptPath)
    .then(() => true)
    .catch(() => false);

  if (!hasPrompt) {
    return "";
  }

  return (await fs.readFile(promptPath, "utf8")).trim();
}

export async function executeToolCommand(
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
