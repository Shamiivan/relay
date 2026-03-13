import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../lib/google-auth";
import { readJsonInput, writeJsonOutput } from "../lib/json-stdio";

const inputSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(20).default(10),
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

    if (/429|rate/i.test(error.message)) {
      return { type: "rate_limit", retryAfterMs: 60000 };
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
    const response = await client.files.list({
      q: input.query,
      pageSize: input.maxResults,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields:
        "files(id,name,mimeType,webViewLink,parents,modifiedTime,owners(displayName,emailAddress),driveId),nextPageToken",
      orderBy: "modifiedTime desc",
    });

    writeJsonOutput({
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
      nextPageToken: response.data.nextPageToken ?? "",
    });
  } catch (error) {
    writeJsonOutput({ error: classifyError(error) });
  }
}

void main();
