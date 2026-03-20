import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type FileToolErrorType =
  | "validation"
  | "not_found"
  | "already_exists"
  | "path_not_allowed"
  | "invalid_path"
  | "permission_denied"
  | "binary_not_supported"
  | "match_not_found"
  | "match_not_unique"
  | "no_change"
  | "write_failed";

export class FileToolError extends Error {
  type: FileToolErrorType;
  path?: string;

  constructor(type: FileToolErrorType, message: string, options?: { path?: string }) {
    super(message);
    this.name = "FileToolError";
    this.type = type;
    this.path = options?.path;
  }
}

export function resolveWorkspacePath(rawPath: string, workspaceRoot: string = process.cwd()): {
  workspaceRoot: string;
  resolvedPath: string;
  relativePath: string;
} {
  if (rawPath.includes("\0")) {
    throw new FileToolError("invalid_path", "Path cannot contain null bytes", { path: rawPath });
  }

  const root = path.resolve(workspaceRoot);
  const resolvedPath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(root, rawPath);
  const relativePath = path.relative(root, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new FileToolError(
      "path_not_allowed",
      `Path must stay inside the workspace root: ${root}`,
      { path: rawPath },
    );
  }

  return {
    workspaceRoot: root,
    resolvedPath,
    relativePath: relativePath || path.basename(resolvedPath),
  };
}

export function mapFsError(error: unknown, filePath: string, action: string): FileToolError {
  if (!(error instanceof Error) || !("code" in error)) {
    return new FileToolError("write_failed", `Failed to ${action}: ${filePath}`, { path: filePath });
  }

  const code = error.code;
  if (code === "ENOENT") {
    return new FileToolError("not_found", `Path not found while trying to ${action}: ${filePath}`, { path: filePath });
  }
  if (code === "EACCES" || code === "EPERM") {
    return new FileToolError("permission_denied", `Permission denied while trying to ${action}: ${filePath}`, {
      path: filePath,
    });
  }
  if (code === "ENOTDIR" || code === "EINVAL") {
    return new FileToolError("invalid_path", `Invalid path while trying to ${action}: ${filePath}`, { path: filePath });
  }
  if (code === "EISDIR") {
    return new FileToolError("invalid_path", `Expected a file but found a directory: ${filePath}`, { path: filePath });
  }
  if (code === "EEXIST") {
    return new FileToolError("already_exists", `Path already exists: ${filePath}`, { path: filePath });
  }

  return new FileToolError(
    "write_failed",
    error.message || `Failed to ${action}: ${filePath}`,
    { path: filePath },
  );
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw mapFsError(error, filePath, "stat path");
  }
}

export function assertTextContent(value: string, fieldName: string): void {
  if (value.includes("\0")) {
    throw new FileToolError(
      "binary_not_supported",
      `${fieldName} contains null bytes; binary content is not supported by this tool`,
      { path: fieldName },
    );
  }
}

export async function readTextFile(filePath: string): Promise<string> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    throw mapFsError(error, filePath, "read file");
  }
  assertTextContent(content, "Existing file content");
  return content;
}

export async function writeFileAtomically(filePath: string, content: string): Promise<number> {
  assertTextContent(content, "Content");
  const parentDir = path.dirname(filePath);
  const tempPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await mkdir(parentDir, { recursive: true });
    await writeFile(tempPath, content, "utf8");
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw mapFsError(error, filePath, "write file");
  }
  return Buffer.byteLength(content, "utf8");
}

type LineOp =
  | { type: "equal"; line: string }
  | { type: "remove"; line: string }
  | { type: "add"; line: string };

function splitLines(value: string): string[] {
  return value.split("\n");
}

function diffLines(oldLines: string[], newLines: string[]): LineOp[] {
  const dp: number[][] = Array.from({ length: oldLines.length + 1 }, () =>
    Array.from({ length: newLines.length + 1 }, () => 0)
  );

  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      dp[i][j] = oldLines[i] === newLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const operations: LineOp[] = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      operations.push({ type: "equal", line: oldLines[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      operations.push({ type: "remove", line: oldLines[i] });
      i += 1;
    } else {
      operations.push({ type: "add", line: newLines[j] });
      j += 1;
    }
  }

  while (i < oldLines.length) {
    operations.push({ type: "remove", line: oldLines[i] });
    i += 1;
  }

  while (j < newLines.length) {
    operations.push({ type: "add", line: newLines[j] });
    j += 1;
  }

  return operations;
}

function buildUnifiedHunks(operations: LineOp[], contextLines: number): string[] {
  const hunks: string[] = [];
  let oldLine = 1;
  let newLine = 1;
  let index = 0;

  while (index < operations.length) {
    while (index < operations.length && operations[index]?.type === "equal") {
      oldLine += 1;
      newLine += 1;
      index += 1;
    }

    if (index >= operations.length) {
      break;
    }

    let hunkStart = Math.max(0, index - contextLines);
    let oldStart = oldLine;
    let newStart = newLine;

    for (let back = index - 1; back >= hunkStart; back -= 1) {
      if (operations[back]?.type === "equal") {
        oldStart -= 1;
        newStart -= 1;
      }
    }

    let hunkEnd = index;
    let trailingEquals = 0;

    while (hunkEnd < operations.length) {
      const op = operations[hunkEnd];
      if (op?.type === "equal") {
        trailingEquals += 1;
        if (trailingEquals > contextLines) {
          hunkEnd -= contextLines;
          break;
        }
      } else {
        trailingEquals = 0;
      }
      hunkEnd += 1;
    }

    if (hunkEnd >= operations.length) {
      hunkEnd = operations.length;
    }

    const hunkOps = operations.slice(hunkStart, hunkEnd);
    let oldCount = 0;
    let newCount = 0;
    const lines: string[] = [];

    for (const op of hunkOps) {
      if (op.type === "equal") {
        oldCount += 1;
        newCount += 1;
        lines.push(` ${op.line}`);
      } else if (op.type === "remove") {
        oldCount += 1;
        lines.push(`-${op.line}`);
      } else {
        newCount += 1;
        lines.push(`+${op.line}`);
      }
    }

    hunks.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n${lines.join("\n")}`);

    for (let cursor = index; cursor < hunkEnd; cursor += 1) {
      if (operations[cursor]?.type !== "add") {
        oldLine += 1;
      }
      if (operations[cursor]?.type !== "remove") {
        newLine += 1;
      }
    }

    index = hunkEnd;
  }

  return hunks;
}

export function createUnifiedDiff(oldText: string, newText: string, fileLabel: string): string {
  if (oldText === newText) {
    return "";
  }

  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  const operations = diffLines(oldLines, newLines);
  const hunks = buildUnifiedHunks(operations, 3);

  return [
    `--- ${fileLabel}`,
    `+++ ${fileLabel}`,
    ...hunks,
  ].join("\n");
}
