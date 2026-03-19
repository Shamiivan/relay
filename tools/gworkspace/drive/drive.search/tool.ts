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

export const driveSearchTool = defineTool({
  moduleUrl: import.meta.url,
  name: "drive.search",
  resource: "drive",
  capability: "search",
  description: "Search Google Drive files using Drive query syntax and return file metadata.",
  idempotent: true,
  input: z.object({
    query: z.string().min(1).describe(
      "The Google Drive search query to run, for example name contains 'invoice' and trashed = false.",
    ),
    maxResults: z.number().int().min(1).max(20).default(10).describe(
      "Maximum files to return, between 1 and 20.",
    ),
  }),
  output: z.object({
    files: z.array(driveFileSchema).default([]),
    nextPageToken: z.string().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.drive({
      version: "v3",
      auth: getGoogleAuth(),
    });
    const response = await client.files.list({
      q: input.query,
      pageSize: input.maxResults,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields:
        "files(id,name,mimeType,webViewLink,parents,modifiedTime,owners(displayName,emailAddress),driveId),nextPageToken",
      orderBy: "modifiedTime desc",
    });

    return {
      files: (response.data.files ?? []).map((file) => ({
        id: file.id ?? "",
        name: file.name ?? "",
        mimeType: file.mimeType ?? "",
        webViewLink: file.webViewLink ?? "",
        parents: file.parents ?? [],
        modifiedTime: file.modifiedTime ?? "",
        driveId: file.driveId ?? "",
        owners: (file.owners ?? []).map((owner) => ({
          displayName: owner.displayName ?? "",
          emailAddress: owner.emailAddress ?? "",
        })),
      })),
      nextPageToken: response.data.nextPageToken ?? undefined,
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
      if (/429|rate/i.test(error.message)) {
        return { type: "rate_limit", message: "Rate limited, retry after 60s" };
      }
    }
    return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Google Drive error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(driveSearchTool);
}
