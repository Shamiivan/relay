import { google } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool, toolErrorSchema } from "../../../sdk";

export const docsWriteTool = defineTool({
  name: "docs.write",
  resource: "docs",
  capability: "update",
  description: "Replace the body text of a Google Docs document when you know the document id.",
  destructive: true,
  updateMode: "replace",
  input: z.object({
    documentId: z.string().min(1).describe("The Google Docs document id."),
    text: z.string().describe("The full replacement body text for the document."),
  }),
  output: z.object({
    documentId: z.string().optional(),
    updated: z.boolean().optional(),
    error: toolErrorSchema.optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const auth = getGoogleAuth();
    const docsClient = google.docs({
      version: "v1",
      auth,
    });
    const document = await docsClient.documents.get({
      documentId: input.documentId,
    });
    const endIndex = document.data.body?.content?.at(-1)?.endIndex ?? 1;
    const requests: Array<Record<string, unknown>> = [];

    if (endIndex > 2) {
      requests.push({
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: endIndex - 1,
          },
        },
      });
    }

    if (input.text.length > 0) {
      requests.push({
        insertText: {
          location: {
            index: 1,
          },
          text: input.text,
        },
      });
    }

    await docsClient.documents.batchUpdate({
      documentId: input.documentId,
      requestBody: {
        requests,
      },
    });

    return {
      documentId: input.documentId,
      updated: true,
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
        return { error: { type: "not_found", id: "document" } };
      }
    }

    return {
      error: {
        type: "external_error",
        message: error instanceof Error ? error.message : "Unknown Google Docs error",
      },
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(docsWriteTool);
}
