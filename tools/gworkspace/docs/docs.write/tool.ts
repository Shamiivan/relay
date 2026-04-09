import { google, type docs_v1 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { resolveRequestedTab } from "../shared/tabs";

export function buildWriteRequests(
  body: docs_v1.Schema$Body | undefined,
  text: string,
  tabId?: string,
) {
  const endIndex = body?.content?.at(-1)?.endIndex ?? 1;
  const requests: Array<Record<string, unknown>> = [];

  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
          ...(tabId ? { tabId } : {}),
        },
      },
    });
  }

  if (text.length > 0) {
    requests.push({
      insertText: {
        location: {
          index: 1,
          ...(tabId ? { tabId } : {}),
        },
        text,
      },
    });
  }

  return requests;
}

export async function writeDocument(
  input: { documentId: string; text: string; tabId?: string },
  opts: { client: ReturnType<typeof google.docs> },
) {
  const document = await opts.client.documents.get({
    documentId: input.documentId,
    includeTabsContent: Boolean(input.tabId),
  });
  const tab = resolveRequestedTab(document.data, input.tabId);
  const requests = buildWriteRequests(tab.body, input.text, tab.tabId);

  await opts.client.documents.batchUpdate({
    documentId: input.documentId,
    requestBody: {
      requests,
    },
  });

  return {
    documentId: input.documentId,
    updated: true,
  };
}

export const docsWriteTool = defineTool({
  moduleUrl: import.meta.url,
  name: "docs.write",
  resource: "docs",
  capability: "update",
  description: "Replace the body text of a Google Docs document when you know the document id.",
  destructive: true,
  updateMode: "replace",
  input: z.object({
    documentId: z.string().min(1).describe("The Google Docs document id."),
    tabId: z.string().min(1).optional().describe("Optional tab id to replace within a multi-tab Google Doc."),
    text: z.string().describe("The full replacement body text for the document."),
  }),
  output: z.object({
    documentId: z.string().optional(),
    updated: z.boolean().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const auth = getGoogleAuth();
    const docsClient = google.docs({
      version: "v1",
      auth,
    });
    return writeDocument(input, { client: docsClient });
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
  void runDeclaredTool(docsWriteTool);
}
