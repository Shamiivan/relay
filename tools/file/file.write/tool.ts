import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../sdk";
import type { ToolErrorInfo } from "../../sdk";
import {
  createUnifiedDiff,
  FileToolError,
  mapFsError,
  pathExists,
  readTextFile,
  resolveWorkspacePath,
  writeFileAtomically,
} from "../lib.ts";

const inputSchema = z.object({
  path: z.string().min(1).describe("Relative or absolute path to write inside the workspace."),
  content: z.string().describe("Full file contents to write."),
  mode: z.enum(["create", "overwrite", "upsert"]).default("upsert").describe(
    "How to handle an existing file.",
  ),
});

const outputSchema = z.object({
  path: z.string(),
  resolvedPath: z.string(),
  mode: z.enum(["create", "overwrite", "upsert"]),
  created: z.boolean(),
  bytesWritten: z.number().int().nonnegative(),
  diff: z.string().optional(),
});

export async function writeWorkspaceFile(
  rawInput: z.input<typeof inputSchema>,
  options?: {
    workspaceRoot?: string;
    writeFileAtomicallyImpl?: typeof writeFileAtomically;
  },
): Promise<z.output<typeof outputSchema>> {
  const input = inputSchema.parse(rawInput);
  const { resolvedPath, relativePath } = resolveWorkspacePath(input.path, options?.workspaceRoot);
  const existedBefore = await pathExists(resolvedPath);

  if (input.mode === "create" && existedBefore) {
    throw new FileToolError("already_exists", `File already exists: ${relativePath}`, { path: relativePath });
  }
  if (input.mode === "overwrite" && !existedBefore) {
    throw new FileToolError("not_found", `File does not exist for overwrite: ${relativePath}`, { path: relativePath });
  }

  const previousContent = existedBefore ? await readTextFile(resolvedPath) : undefined;
  const writeFileAtomicallyImpl = options?.writeFileAtomicallyImpl ?? writeFileAtomically;
  let bytesWritten: number;
  try {
    bytesWritten = await writeFileAtomicallyImpl(resolvedPath, input.content);
  } catch (error) {
    if (error instanceof FileToolError) {
      throw error;
    }
    throw mapFsError(error, relativePath, "write file");
  }
  const diff = previousContent !== undefined
    ? createUnifiedDiff(previousContent, input.content, relativePath)
    : undefined;

  return {
    path: relativePath,
    resolvedPath,
    mode: input.mode,
    created: !existedBefore,
    bytesWritten,
    ...(diff ? { diff } : {}),
  };
}

export const fileWriteTool = defineTool({
  moduleUrl: import.meta.url,
  name: "file.write",
  resource: "file",
  capability: "create",
  description: "Create, overwrite, or upsert a local text file inside the workspace with atomic writes.",
  updateMode: "replace",
  input: inputSchema,
  output: outputSchema,
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return writeWorkspaceFile(input);
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof FileToolError) {
      return {
        type: error.type,
        message: error.message,
        ...(error.path ? { path: error.path } : {}),
      };
    }
    return {
      type: "write_failed",
      message: error instanceof Error ? error.message : "Unknown file write error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(fileWriteTool);
}
