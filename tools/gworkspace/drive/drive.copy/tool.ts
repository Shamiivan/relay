import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool, toolErrorSchema } from "../../../sdk";

const driveOwnerSchema = z.object({
  displayName: z.string(),
  emailAddress: z.string(),
});

const driveFileSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  mimeType: z.string().optional(),
  webViewLink: z.string().optional(),
  parents: z.array(z.string()).optional(),
  modifiedTime: z.string().optional(),
  driveId: z.string().optional(),
  owners: z.array(driveOwnerSchema).optional(),
});

export const driveCopyTool = defineTool({
  moduleUrl: import.meta.url,
  name: "drive.copy",
  resource: "drive",
  capability: "create",
  description: "Copy a Google Drive file when you know the source file id.",
  input: z.object({
    fileId: z.string().min(1).describe("The source Drive file id to copy."),
    name: z.string().min(1).describe("The name for the copied file."),
    parentId: z.string().min(1).optional().describe(
      "Optional parent folder id for the copy. If omitted, Drive keeps the file in its default location.",
    ),
  }),
  output: driveFileSchema.extend({
    error: toolErrorSchema.optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.drive({
      version: "v3",
      auth: getGoogleAuth(),
    });
    const response = await client.files.copy({
      fileId: input.fileId,
      supportsAllDrives: true,
      requestBody: {
        name: input.name,
        parents: input.parentId ? [input.parentId] : undefined,
      },
      fields:
        "id,name,mimeType,webViewLink,parents,modifiedTime,owners(displayName,emailAddress),driveId",
    });
    const file = response.data;

    return {
      id: file.id ?? "",
      name: file.name ?? input.name,
      mimeType: file.mimeType ?? "",
      webViewLink: file.webViewLink ?? "",
      parents: file.parents ?? [],
      modifiedTime: file.modifiedTime ?? "",
      driveId: file.driveId ?? "",
      owners: (file.owners ?? []).map((owner) => ({
        displayName: owner.displayName ?? "",
        emailAddress: owner.emailAddress ?? "",
      })),
    };
  },
  onError(error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return {
        error: {
          type: "validation",
          field: issue?.path.join(".") || "input",
          reason: issue?.message || "Invalid input",
        },
      };
    }

    if (error instanceof Error) {
      if (/auth|credential|token|unauthorized|insufficient/i.test(error.message)) {
        return {
          error: {
            type: "auth_error",
            message: error.message,
          },
        };
      }

      if (/404|not found/i.test(error.message)) {
        return { error: { type: "not_found", id: "file" } };
      }
    }

    return {
      error: {
        type: "external_error",
        message: error instanceof Error ? error.message : "Unknown Google Drive error",
      },
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(driveCopyTool);
}
