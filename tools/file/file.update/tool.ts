import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool } from "../../sdk";
import type { ToolErrorInfo } from "../../sdk";
import {
  assertTextContent,
  createUnifiedDiff,
  FileToolError,
  mapFsError,
  readTextFile,
  resolveWorkspacePath,
  writeFileAtomically,
} from "../lib.ts";

const inputSchema = z.object({
  path: z.string().min(1).describe("Relative or absolute path to an existing file inside the workspace."),
  oldText: z.string().min(1).describe("Exact text to replace. Must match exactly once."),
  newText: z.string().describe("Replacement text."),
});

const outputSchema = z.object({
  path: z.string(),
  resolvedPath: z.string(),
  bytesWritten: z.number().int().nonnegative(),
  diff: z.string(),
  replaced: z.boolean(),
});

export async function updateWorkspaceFile(
  rawInput: z.input<typeof inputSchema>,
  options?: {
    workspaceRoot?: string;
    writeFileAtomicallyImpl?: typeof writeFileAtomically;
  },
): Promise<z.output<typeof outputSchema>> {
  const input = inputSchema.parse(rawInput);
  assertTextContent(input.oldText, "oldText");
  assertTextContent(input.newText, "newText");

  const { resolvedPath, relativePath } = resolveWorkspacePath(input.path, options?.workspaceRoot);
  const currentContent = await readTextFile(resolvedPath);

  const occurrences = currentContent.split(input.oldText).length - 1;
  if (occurrences === 0) {
    throw new FileToolError(
      "match_not_found",
      `Could not find the exact text in ${relativePath}`,
      { path: relativePath },
    );
  }
  if (occurrences > 1) {
    throw new FileToolError(
      "match_not_unique",
      `Found ${occurrences} occurrences in ${relativePath}; oldText must be unique`,
      { path: relativePath },
    );
  }

  const nextContent = currentContent.replace(input.oldText, input.newText);
  if (nextContent === currentContent) {
    throw new FileToolError("no_change", `No changes were produced for ${relativePath}`, { path: relativePath });
  }

  const writeFileAtomicallyImpl = options?.writeFileAtomicallyImpl ?? writeFileAtomically;
  let bytesWritten: number;
  try {
    bytesWritten = await writeFileAtomicallyImpl(resolvedPath, nextContent);
  } catch (error) {
    if (error instanceof FileToolError) {
      throw error;
    }
    throw mapFsError(error, relativePath, "write file");
  }
  const diff = createUnifiedDiff(currentContent, nextContent, relativePath);

  return {
    path: relativePath,
    resolvedPath,
    bytesWritten,
    diff,
    replaced: true,
  };
}

export const fileUpdateTool = defineTool({
  moduleUrl: import.meta.url,
  name: "file.update",
  resource: "file",
  capability: "update",
  description: "Update an existing local text file by replacing exact text once, with atomic writes.",
  updateMode: "granular",
  input: inputSchema,
  output: outputSchema,
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return updateWorkspaceFile(input);
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
      message: error instanceof Error ? error.message : "Unknown file update error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(fileUpdateTool);
}
