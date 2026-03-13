import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../lib/google-auth";
import { readJsonInput, writeJsonOutput } from "../lib/json-stdio";

const inputSchema = z.object({
  fileId: z.string().min(1),
});

function classifyError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    return {
      type: "validation",
      field: issue?.path.join(".") || "input",
      reason: issue?.message || "Invalid input",
    };
  }

  if (error instanceof Error) {
    if (/auth|credential|token|unauthorized|insufficient/i.test(error.message)) {
      return { type: "auth_error" };
    }

    if (/404|not found/i.test(error.message)) {
      return { type: "not_found", id: "file" };
    }
  }

  return {
    type: "external_error",
    message: error instanceof Error ? error.message : "Unknown Google Drive error",
  };
}

async function main() {
  try {
    const input = inputSchema.parse(await readJsonInput());
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

    writeJsonOutput({
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
    });
  } catch (error) {
    writeJsonOutput({ error: classifyError(error) });
  }
}

void main();
