import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";

function extractText(
  content: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> = [],
): string {
  const chunks: string[] = [];

  for (const element of content) {
    const paragraph = element.paragraph;
    if (!paragraph?.elements) {
      continue;
    }

    for (const part of paragraph.elements) {
      const text = part.textRun?.content;
      if (text) {
        chunks.push(text);
      }
    }
  }

  return chunks.join("");
}

export const docsReadTool = defineTool({
  moduleUrl: import.meta.url,
  name: "docs.read",
  resource: "docs",
  capability: "read",
  description: "Read a Google Docs document as plain text when you know the document id.",
  idempotent: true,
  input: z.object({
    documentId: z.string().min(1).describe("The Google Docs document id."),
  }),
  output: z.object({
    documentId: z.string().optional(),
    title: z.string().optional(),
    text: z.string().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.docs({
      version: "v1",
      auth: getGoogleAuth(),
    });

    const response = await client.documents.get({
      documentId: input.documentId,
    });

    const document = response.data;

    const documentId = document.documentId ?? input.documentId;
    const title = document.title ?? "";
    const content = document.body?.content as any;
    const text = extractText(content);

    return {
      documentId,
      title,
      text,
    };
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof Error) {
      if (/auth|credential|token|unauthorized|insufficient/i.test(error.message)) {
        return { type: "auth_error", message: error.message };
      }
      if (/404|not found/i.test(error.message)) {
        return { type: "not_found", message: "Document not found" };
      }
    }
    return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Google Docs error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(docsReadTool);
}
