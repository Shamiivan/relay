import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";

const driveOwnerSchema = z.object({
  displayName: z.string(),
  emailAddress: z.string(),
});

const driveFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  webViewLink: z.string(),
  parents: z.array(z.string()),
  modifiedTime: z.string(),
  driveId: z.string(),
  owners: z.array(driveOwnerSchema),
});

const inputSchema = z.object({
  localPath: z.string().min(1).describe("Relative or absolute path to a local file or folder inside the workspace."),
  parentId: z.string().min(1).optional().describe("Optional Google Drive folder id to upload into."),
  name: z.string().min(1).optional().describe("Optional override for the uploaded top-level file or folder name."),
  recursive: z.boolean().default(true).describe(
    "When localPath is a folder, recursively upload its contents. Ignored for files.",
  ),
  mimeType: z.string().min(1).optional().describe("Optional MIME type override for file uploads."),
});

const outputSchema = z.object({
  kind: z.enum(["file", "folder"]),
  localPath: z.string(),
  resolvedLocalPath: z.string(),
  root: driveFileSchema,
  uploadedFiles: z.number().int().nonnegative(),
  createdFolders: z.number().int().nonnegative(),
});

type DriveFile = z.output<typeof driveFileSchema>;

type DriveClient = {
  files: {
    create: (args: Record<string, unknown>) => Promise<{ data: Record<string, unknown> }>;
  };
};

class DriveUploadError extends Error {
  type:
    | "validation"
    | "not_found"
    | "path_not_allowed"
    | "invalid_path"
    | "auth_error"
    | "external_error";
  path?: string;

  constructor(
    type: DriveUploadError["type"],
    message: string,
    options?: { path?: string },
  ) {
    super(message);
    this.name = "DriveUploadError";
    this.type = type;
    this.path = options?.path;
  }
}

function mapDriveFile(file: Record<string, unknown>): DriveFile {
  return {
    id: typeof file.id === "string" ? file.id : "",
    name: typeof file.name === "string" ? file.name : "",
    mimeType: typeof file.mimeType === "string" ? file.mimeType : "",
    webViewLink: typeof file.webViewLink === "string" ? file.webViewLink : "",
    parents: Array.isArray(file.parents) ? file.parents.filter((value): value is string => typeof value === "string") : [],
    modifiedTime: typeof file.modifiedTime === "string" ? file.modifiedTime : "",
    driveId: typeof file.driveId === "string" ? file.driveId : "",
    owners: Array.isArray(file.owners)
      ? file.owners.map((owner) => {
        const record = owner as Record<string, unknown>;
        return {
          displayName: typeof record.displayName === "string" ? record.displayName : "",
          emailAddress: typeof record.emailAddress === "string" ? record.emailAddress : "",
        };
      })
      : [],
  };
}

function getDriveClient(): DriveClient {
  const client = google.drive({
    version: "v3",
    auth: getGoogleAuth(),
  });

  return {
    files: {
      async create(args: Record<string, unknown>) {
        const response = await client.files.create(args);
        return { data: response.data as Record<string, unknown> };
      },
    },
  };
}

function resolveLocalWorkspacePath(rawPath: string, workspaceRoot: string = process.cwd()): {
  resolvedPath: string;
  relativePath: string;
} {
  if (rawPath.includes("\0")) {
    throw new DriveUploadError("invalid_path", "Path cannot contain null bytes", { path: rawPath });
  }

  const root = path.resolve(workspaceRoot);
  const resolvedPath = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(root, rawPath);
  const relativePath = path.relative(root, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new DriveUploadError(
      "path_not_allowed",
      `Path must stay inside the workspace root: ${root}`,
      { path: rawPath },
    );
  }

  return {
    resolvedPath,
    relativePath: relativePath || path.basename(resolvedPath),
  };
}

async function statLocalPath(localPath: string, rawPath: string): Promise<import("node:fs").Stats> {
  try {
    return await stat(localPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new DriveUploadError("not_found", `Local path not found: ${rawPath}`, { path: rawPath });
    }
    if (error instanceof Error && "code" in error && (error.code === "ENOTDIR" || error.code === "EINVAL")) {
      throw new DriveUploadError("invalid_path", `Invalid local path: ${rawPath}`, { path: rawPath });
    }
    throw new DriveUploadError(
      "external_error",
      error instanceof Error ? error.message : `Failed to read local path: ${rawPath}`,
      { path: rawPath },
    );
  }
}

async function createDriveFolder(
  client: DriveClient,
  name: string,
  parentId?: string,
): Promise<DriveFile> {
  const response = await client.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields:
      "id,name,mimeType,webViewLink,parents,modifiedTime,owners(displayName,emailAddress),driveId",
  });

  return mapDriveFile(response.data);
}

async function uploadDriveFile(
  client: DriveClient,
  filePath: string,
  name: string,
  parentId?: string,
  mimeType?: string,
): Promise<DriveFile> {
  const response = await client.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      parents: parentId ? [parentId] : undefined,
    },
    media: {
      ...(mimeType ? { mimeType } : {}),
      body: createReadStream(filePath),
    },
    fields:
      "id,name,mimeType,webViewLink,parents,modifiedTime,owners(displayName,emailAddress),driveId",
  });

  return mapDriveFile(response.data);
}

async function uploadDirectoryTree(
  client: DriveClient,
  directoryPath: string,
  name: string,
  parentId: string | undefined,
  recursive: boolean,
): Promise<{ root: DriveFile; uploadedFiles: number; createdFolders: number }> {
  const root = await createDriveFolder(client, name, parentId);
  let uploadedFiles = 0;
  let createdFolders = 1;

  if (!recursive) {
    return { root, uploadedFiles, createdFolders };
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await uploadDirectoryTree(client, entryPath, entry.name, root.id, true);
      uploadedFiles += nested.uploadedFiles;
      createdFolders += nested.createdFolders;
      continue;
    }
    if (entry.isFile()) {
      await uploadDriveFile(client, entryPath, entry.name, root.id);
      uploadedFiles += 1;
    }
  }

  return { root, uploadedFiles, createdFolders };
}

export async function uploadWorkspacePathToDrive(
  rawInput: z.input<typeof inputSchema>,
  options?: {
    workspaceRoot?: string;
    client?: DriveClient;
  },
): Promise<z.output<typeof outputSchema>> {
  const input = inputSchema.parse(rawInput);
  const { resolvedPath, relativePath } = resolveLocalWorkspacePath(input.localPath, options?.workspaceRoot);
  const stats = await statLocalPath(resolvedPath, input.localPath);
  const client = options?.client ?? getDriveClient();

  try {
    if (stats.isDirectory()) {
      const result = await uploadDirectoryTree(
        client,
        resolvedPath,
        input.name ?? path.basename(resolvedPath),
        input.parentId,
        input.recursive,
      );
      return {
        kind: "folder",
        localPath: relativePath,
        resolvedLocalPath: resolvedPath,
        root: result.root,
        uploadedFiles: result.uploadedFiles,
        createdFolders: result.createdFolders,
      };
    }

    if (!stats.isFile()) {
      throw new DriveUploadError("invalid_path", `Only files and folders can be uploaded: ${relativePath}`, {
        path: relativePath,
      });
    }

    const root = await uploadDriveFile(
      client,
      resolvedPath,
      input.name ?? path.basename(resolvedPath),
      input.parentId,
      input.mimeType,
    );

    return {
      kind: "file",
      localPath: relativePath,
      resolvedLocalPath: resolvedPath,
      root,
      uploadedFiles: 1,
      createdFolders: 0,
    };
  } catch (error) {
    if (error instanceof DriveUploadError) {
      throw error;
    }
    if (error instanceof Error && /auth|credential|token|unauthorized|insufficient/i.test(error.message)) {
      throw new DriveUploadError("auth_error", error.message);
    }
    throw new DriveUploadError(
      "external_error",
      error instanceof Error ? error.message : "Unknown Google Drive upload error",
    );
  }
}

export const driveUploadTool = defineTool({
  moduleUrl: import.meta.url,
  name: "drive.upload",
  resource: "drive",
  capability: "create",
  description: "Upload a local file to Google Drive or create a Drive folder from a local folder path.",
  input: inputSchema,
  output: outputSchema,
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    return uploadWorkspacePathToDrive(input);
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof DriveUploadError) {
      return {
        type: error.type,
        message: error.message,
        ...(error.path ? { path: error.path } : {}),
      };
    }
    return {
      type: "external_error",
      message: error instanceof Error ? error.message : "Unknown Google Drive upload error",
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(driveUploadTool);
}
