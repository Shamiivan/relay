import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { listTabSummaries, resolveRequestedTab } from "../shared/tabs";

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

export async function readDocument(
  input: { documentId: string; tabId?: string; includeTabs?: boolean },
  opts: { client: ReturnType<typeof google.docs> },
) {
  const response = await opts.client.documents.get({
    documentId: input.documentId,
    includeTabsContent: Boolean(input.tabId || input.includeTabs),
  });

  const document = response.data;
  const tab = resolveRequestedTab(document, input.tabId);

  return {
    documentId: document.documentId ?? input.documentId,
    title: document.title ?? "",
    text: extractText(tab.body?.content as any),
    tabs: input.includeTabs ? listTabSummaries(document) : undefined,
  };
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
    tabId: z.string().min(1).optional().describe("Optional tab id to read within a multi-tab Google Doc."),
    includeTabs: z.boolean().optional().describe("Include a flattened list of document tabs with ids and titles."),
  }),
  output: z.object({
    documentId: z.string().optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    tabs: z.array(z.object({
      tabId: z.string(),
      title: z.string(),
      parentTabId: z.string().optional(),
      index: z.number().int().nonnegative(),
    })).optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.docs({
      version: "v1",
      auth: getGoogleAuth(),
    });
    return readDocument(input, { client });
  },
  onError(error): ToolErrorInfo {
    if (error instanceof z.ZodError) {
      return { type: "validation", message: error.issues[0]?.message };
    }
    if (error instanceof Error) {
      if (/tab not found/i.test(error.message)) {
        return { type: "not_found", message: error.message, field: "tabId" };
      }
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
