import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";

const driveOwnerSchema = z.object({
  displayName: z.string(),
  emailAddress: z.string(),
});

export const driveGetFileTool = defineTool({
  name: "drive.getFile",
  resource: "drive",
  capability: "read",
  description: "Get Google Drive file metadata when you already know the Drive file id.",
  idempotent: true,
  input: z.object({
    fileId: z.string().min(1).describe("The Google Drive file id."),
  }),
  output: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    mimeType: z.string().optional(),
    description: z.string().optional(),
    webViewLink: z.string().optional(),
    webContentLink: z.string().optional(),
    size: z.string().optional(),
    parents: z.array(z.string()).optional(),
    modifiedTime: z.string().optional(),
    createdTime: z.string().optional(),
    shared: z.boolean().optional(),
    trashed: z.boolean().optional(),
    driveId: z.string().optional(),
    owners: z.array(driveOwnerSchema).optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.drive({
      version: "v3",
      auth: getGoogleAuth(),
    });
    const response = await client.files.get({
      fileId: input.fileId,
      supportsAllDrives: true,
      fields:
        "id,name,mimeType,description,webViewLink,webContentLink,size,parents,modifiedTime,createdTime,owners(displayName,emailAddress),shared,trashed,driveId",
    });
    const file = response.data;

    return {
      id: file.id ?? input.fileId,
      name: file.name ?? "",
      mimeType: file.mimeType ?? "",
      description: file.description ?? "",
      webViewLink: file.webViewLink ?? "",
      webContentLink: file.webContentLink ?? "",
      size: file.size ?? "0",
      parents: file.parents ?? [],
      modifiedTime: file.modifiedTime ?? "",
      createdTime: file.createdTime ?? "",
      shared: Boolean(file.shared),
      trashed: Boolean(file.trashed),
      driveId: file.driveId ?? "",
      owners: (file.owners ?? []).map((owner) => ({
        displayName: owner.displayName ?? "",
        emailAddress: owner.emailAddress ?? "",
      })),
    };
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof Error) {
      if (/auth|credential|token|unauthorized|insufficient/i.test(error.message)) {
        return { type: "auth_error" };
      }
      if (/404|not found/i.test(error.message)) {
        return { type: "not_found", message: "File not found" };
      }
    }
    return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Google Drive error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(driveGetFileTool);
}
