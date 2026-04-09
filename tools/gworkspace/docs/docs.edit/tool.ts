import { google, type docs_v1 } from "googleapis";
import { z } from "zod";
import { getGoogleAuth } from "../../../lib/google-auth";
import { defineTool, promptFile, runDeclaredTool } from "../../../sdk";
import type { ToolErrorInfo } from "../../../sdk";
import { resolveRequestedTab } from "../shared/tabs";

export type DocsClient = docs_v1.Docs;
type DocsDocument = docs_v1.Schema$Document;
type DocsRequest = docs_v1.Schema$Request;

class DocsEditResolutionError extends Error {
  readonly type: "target_not_found" | "invalid_range";
  readonly field?: string;

  constructor(type: "target_not_found" | "invalid_range", message: string, field?: string) {
    super(message);
    this.name = "DocsEditResolutionError";
    this.type = type;
    this.field = field;
  }
}

const rgbColorSchema = z.object({
  red: z.number().min(0).max(1),
  green: z.number().min(0).max(1),
  blue: z.number().min(0).max(1),
});

const textTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z.string().min(1).describe("Exact text to target."),
    occurrence: z.number().int().min(1).default(1).describe("1-based match occurrence."),
    matchCase: z.boolean().default(true).describe("Whether the text match is case-sensitive."),
  }),
  z.object({
    kind: z.literal("range"),
    startIndex: z.number().int().min(1),
    endIndex: z.number().int().min(2),
  }).refine((value) => value.endIndex > value.startIndex, {
    message: "endIndex must be greater than startIndex",
    path: ["endIndex"],
  }),
]);

const insertLocationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("index"), index: z.number().int().min(1) }),
  z.object({ kind: z.literal("start") }),
  z.object({ kind: z.literal("end") }),
  z.object({
    kind: z.literal("beforeText"),
    text: z.string().min(1),
    occurrence: z.number().int().min(1).default(1),
    matchCase: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal("afterText"),
    text: z.string().min(1),
    occurrence: z.number().int().min(1).default(1),
    matchCase: z.boolean().default(true),
  }),
]);

const textStyleSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  smallCaps: z.boolean().optional(),
  linkUrl: z.string().url().optional(),
  foregroundColor: rgbColorSchema.optional(),
  backgroundColor: rgbColorSchema.optional(),
  fontSizePt: z.number().positive().optional(),
  weightedFontFamily: z.object({
    fontFamily: z.string().min(1),
    weight: z.number().int().min(100).max(900).optional(),
  }).optional(),
});

const paragraphStyleSchema = z.object({
  namedStyleType: z.enum([
    "NORMAL_TEXT",
    "TITLE",
    "SUBTITLE",
    "HEADING_1",
    "HEADING_2",
    "HEADING_3",
    "HEADING_4",
    "HEADING_5",
    "HEADING_6",
  ]).optional(),
  alignment: z.enum(["START", "CENTER", "END", "JUSTIFIED"]).optional(),
  direction: z.enum(["LEFT_TO_RIGHT", "RIGHT_TO_LEFT"]).optional(),
  lineSpacing: z.number().positive().optional(),
  spaceAbovePt: z.number().min(0).optional(),
  spaceBelowPt: z.number().min(0).optional(),
  indentStartPt: z.number().optional(),
  indentEndPt: z.number().optional(),
  indentFirstLinePt: z.number().optional(),
});

const docsEditOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("replaceText"),
    target: textTargetSchema,
    replacement: z.string(),
    replaceAll: z.boolean().default(false),
  }),
  z.object({
    op: z.literal("insertText"),
    text: z.string(),
    location: insertLocationSchema,
  }),
  z.object({
    op: z.literal("deleteText"),
    target: textTargetSchema,
  }),
  z.object({
    op: z.literal("formatText"),
    target: textTargetSchema,
    textStyle: textStyleSchema.refine((value) => Object.keys(value).length > 0, {
      message: "textStyle must include at least one field",
    }),
  }),
  z.object({
    op: z.literal("formatParagraph"),
    target: textTargetSchema,
    paragraphStyle: paragraphStyleSchema.refine((value) => Object.keys(value).length > 0, {
      message: "paragraphStyle must include at least one field",
    }),
  }),
  z.object({
    op: z.literal("createBullets"),
    target: textTargetSchema,
    bulletPreset: z.string().min(1).describe("Docs API bullet preset, for example BULLET_DISC_CIRCLE_SQUARE."),
  }),
  z.object({
    op: z.literal("deleteBullets"),
    target: textTargetSchema,
  }),
]);

export type DocsEditOperation = z.output<typeof docsEditOperationSchema>;

function extractDocumentText(document: DocsDocument): string {
  const chunks: string[] = [];

  for (const bodyElement of document.body?.content ?? []) {
    const paragraph = bodyElement.paragraph;
    if (!paragraph?.elements) {
      continue;
    }

    for (const paragraphElement of paragraph.elements) {
      const text = paragraphElement.textRun?.content;
      if (text) {
        chunks.push(text);
      }
    }
  }

  return chunks.join("");
}

function getDocumentEndIndex(document: DocsDocument): number {
  return document.body?.content?.at(-1)?.endIndex ?? 1;
}

function findTextOffset(
  bodyText: string,
  text: string,
  occurrence: number,
  matchCase: boolean,
): number {
  const haystack = matchCase ? bodyText : bodyText.toLocaleLowerCase();
  const needle = matchCase ? text : text.toLocaleLowerCase();
  let fromIndex = 0;

  for (let seen = 1; seen <= occurrence; seen += 1) {
    const matchIndex = haystack.indexOf(needle, fromIndex);
    if (matchIndex === -1) {
      return -1;
    }
    if (seen === occurrence) {
      return matchIndex;
    }
    fromIndex = matchIndex + needle.length;
  }

  return -1;
}

function resolveRange(target: z.output<typeof textTargetSchema>, bodyText: string): { startIndex: number; endIndex: number } {
  if (target.kind === "range") {
    if (target.endIndex > bodyText.length + 1) {
      throw new DocsEditResolutionError(
        "invalid_range",
        `Range endIndex ${target.endIndex} exceeds document length ${bodyText.length + 1}`,
        "target.endIndex",
      );
    }
    return { startIndex: target.startIndex, endIndex: target.endIndex };
  }

  const offset = findTextOffset(bodyText, target.text, target.occurrence, target.matchCase);
  if (offset === -1) {
    throw new DocsEditResolutionError(
      "target_not_found",
      `Target text not found: ${target.text}`,
      "target.text",
    );
  }

  return {
    startIndex: offset + 1,
    endIndex: offset + 1 + target.text.length,
  };
}

function resolveInsertIndex(
  location: z.output<typeof insertLocationSchema>,
  bodyText: string,
  documentEndIndex: number,
): number {
  switch (location.kind) {
    case "index":
      if (location.index > documentEndIndex) {
        throw new DocsEditResolutionError(
          "invalid_range",
          `Insert index ${location.index} exceeds document end index ${documentEndIndex}`,
          "location.index",
        );
      }
      return location.index;
    case "start":
      return 1;
    case "end":
      return Math.max(1, documentEndIndex - 1);
    case "beforeText": {
      const offset = findTextOffset(bodyText, location.text, location.occurrence, location.matchCase);
      if (offset === -1) {
        throw new DocsEditResolutionError(
          "target_not_found",
          `Insert anchor not found: ${location.text}`,
          "location.text",
        );
      }
      return offset + 1;
    }
    case "afterText": {
      const offset = findTextOffset(bodyText, location.text, location.occurrence, location.matchCase);
      if (offset === -1) {
        throw new DocsEditResolutionError(
          "target_not_found",
          `Insert anchor not found: ${location.text}`,
          "location.text",
        );
      }
      return offset + 1 + location.text.length;
    }
  }
}

function mapDocsEditError(error: unknown): ToolErrorInfo {
  if (error instanceof z.ZodError) {
    return { type: "validation", message: error.issues[0]?.message, field: error.issues[0]?.path.join(".") };
  }

  if (error instanceof DocsEditResolutionError) {
    return {
      type: error.type,
      message: error.message,
      field: error.field,
    };
  }

  if (error instanceof Error) {
    if (/tab not found/i.test(error.message)) {
      return { type: "not_found", message: error.message, field: "tabId" };
    }
    if (/target text not found|insert anchor not found/i.test(error.message)) {
      const field = /insert anchor not found/i.test(error.message) ? "location.text" : "target.text";
      return { type: "target_not_found", message: error.message, field };
    }
    if (/range endIndex|insert index .* exceeds document/i.test(error.message)) {
      const field = /insert index/i.test(error.message) ? "location.index" : "target.endIndex";
      return { type: "invalid_range", message: error.message, field };
    }
    if (/auth|credential|token|unauthorized|insufficient|invalid_grant/i.test(error.message)) {
      return { type: "auth_error", message: error.message };
    }
    if (/404|not found/i.test(error.message)) {
      return { type: "not_found", message: "Document not found" };
    }
    if (/429|rate limit|quota/i.test(error.message)) {
      return { type: "rate_limit", message: error.message };
    }
    if (/403|forbidden|permission denied/i.test(error.message)) {
      return { type: "permission_denied", message: error.message };
    }
    if (/400|bad request|invalid requests/i.test(error.message)) {
      return { type: "invalid_request", message: error.message };
    }
  }

  return { type: "external_error", message: error instanceof Error ? error.message : "Unknown Google Docs error" };
}

function docsColor(rgb: z.output<typeof rgbColorSchema>): docs_v1.Schema$OptionalColor {
  return {
    color: {
      rgbColor: {
        red: rgb.red,
        green: rgb.green,
        blue: rgb.blue,
      },
    },
  };
}

function buildTextStyle(
  textStyle: z.output<typeof textStyleSchema>,
): { textStyle: docs_v1.Schema$TextStyle; fields: string } {
  const result: docs_v1.Schema$TextStyle = {};
  const fields: string[] = [];

  if (textStyle.bold !== undefined) {
    result.bold = textStyle.bold;
    fields.push("bold");
  }
  if (textStyle.italic !== undefined) {
    result.italic = textStyle.italic;
    fields.push("italic");
  }
  if (textStyle.underline !== undefined) {
    result.underline = textStyle.underline;
    fields.push("underline");
  }
  if (textStyle.strikethrough !== undefined) {
    result.strikethrough = textStyle.strikethrough;
    fields.push("strikethrough");
  }
  if (textStyle.smallCaps !== undefined) {
    result.smallCaps = textStyle.smallCaps;
    fields.push("smallCaps");
  }
  if (textStyle.linkUrl !== undefined) {
    result.link = { url: textStyle.linkUrl };
    fields.push("link");
  }
  if (textStyle.foregroundColor !== undefined) {
    result.foregroundColor = docsColor(textStyle.foregroundColor);
    fields.push("foregroundColor");
  }
  if (textStyle.backgroundColor !== undefined) {
    result.backgroundColor = docsColor(textStyle.backgroundColor);
    fields.push("backgroundColor");
  }
  if (textStyle.fontSizePt !== undefined) {
    result.fontSize = {
      magnitude: textStyle.fontSizePt,
      unit: "PT",
    };
    fields.push("fontSize");
  }
  if (textStyle.weightedFontFamily !== undefined) {
    result.weightedFontFamily = {
      fontFamily: textStyle.weightedFontFamily.fontFamily,
      weight: textStyle.weightedFontFamily.weight,
    };
    fields.push("weightedFontFamily");
  }

  return { textStyle: result, fields: fields.join(",") };
}

function buildParagraphStyle(
  paragraphStyle: z.output<typeof paragraphStyleSchema>,
): { paragraphStyle: docs_v1.Schema$ParagraphStyle; fields: string } {
  const result: docs_v1.Schema$ParagraphStyle = {};
  const fields: string[] = [];

  if (paragraphStyle.namedStyleType !== undefined) {
    result.namedStyleType = paragraphStyle.namedStyleType;
    fields.push("namedStyleType");
  }
  if (paragraphStyle.alignment !== undefined) {
    result.alignment = paragraphStyle.alignment;
    fields.push("alignment");
  }
  if (paragraphStyle.direction !== undefined) {
    result.direction = paragraphStyle.direction;
    fields.push("direction");
  }
  if (paragraphStyle.lineSpacing !== undefined) {
    result.lineSpacing = paragraphStyle.lineSpacing;
    fields.push("lineSpacing");
  }
  if (paragraphStyle.spaceAbovePt !== undefined) {
    result.spaceAbove = {
      magnitude: paragraphStyle.spaceAbovePt,
      unit: "PT",
    };
    fields.push("spaceAbove");
  }
  if (paragraphStyle.spaceBelowPt !== undefined) {
    result.spaceBelow = {
      magnitude: paragraphStyle.spaceBelowPt,
      unit: "PT",
    };
    fields.push("spaceBelow");
  }
  if (paragraphStyle.indentStartPt !== undefined) {
    result.indentStart = {
      magnitude: paragraphStyle.indentStartPt,
      unit: "PT",
    };
    fields.push("indentStart");
  }
  if (paragraphStyle.indentEndPt !== undefined) {
    result.indentEnd = {
      magnitude: paragraphStyle.indentEndPt,
      unit: "PT",
    };
    fields.push("indentEnd");
  }
  if (paragraphStyle.indentFirstLinePt !== undefined) {
    result.indentFirstLine = {
      magnitude: paragraphStyle.indentFirstLinePt,
      unit: "PT",
    };
    fields.push("indentFirstLine");
  }

  return { paragraphStyle: result, fields: fields.join(",") };
}

function withOptionalTabId<T extends object>(value: T, tabId?: string): T & { tabId?: string } {
  return tabId ? { ...value, tabId } : value;
}

export function buildRequestsForOperation(
  operation: DocsEditOperation,
  document: DocsDocument,
  tabId?: string,
): DocsRequest[] {
  const bodyText = extractDocumentText(document);
  const documentEndIndex = getDocumentEndIndex(document);

  switch (operation.op) {
    case "replaceText":
      if (operation.replaceAll) {
        const target = operation.target.kind === "text"
          ? operation.target
          : {
            text: bodyText.slice(operation.target.startIndex - 1, operation.target.endIndex - 1),
            matchCase: true,
          };

        return [{
          replaceAllText: {
            containsText: {
              text: target.text,
              matchCase: target.matchCase,
            },
            replaceText: operation.replacement,
            tabsCriteria: tabId ? { tabIds: [tabId] } : undefined,
          },
        }];
      }

      return buildRequestsForOperation({
        op: "deleteText",
        target: operation.target,
      }, document, tabId).concat(
        buildRequestsForOperation({
          op: "insertText",
          text: operation.replacement,
          location: operation.target.kind === "range"
            ? { kind: "index", index: operation.target.startIndex }
            : {
              kind: "beforeText",
              text: operation.target.text,
              occurrence: operation.target.occurrence,
              matchCase: operation.target.matchCase,
            },
        }, document, tabId),
      );
    case "insertText": {
      const index = resolveInsertIndex(operation.location, bodyText, documentEndIndex);
      return [{
        insertText: {
          location: withOptionalTabId({ index }, tabId),
          text: operation.text,
        },
      }];
    }
    case "deleteText": {
      const range = resolveRange(operation.target, bodyText);
      return [{
        deleteContentRange: {
          range: withOptionalTabId(range, tabId),
        },
      }];
    }
    case "formatText": {
      const range = resolveRange(operation.target, bodyText);
      const style = buildTextStyle(operation.textStyle);
      return [{
        updateTextStyle: {
          range: withOptionalTabId(range, tabId),
          textStyle: style.textStyle,
          fields: style.fields,
        },
      }];
    }
    case "formatParagraph": {
      const range = resolveRange(operation.target, bodyText);
      const style = buildParagraphStyle(operation.paragraphStyle);
      return [{
        updateParagraphStyle: {
          range: withOptionalTabId(range, tabId),
          paragraphStyle: style.paragraphStyle,
          fields: style.fields,
        },
      }];
    }
    case "createBullets": {
      const range = resolveRange(operation.target, bodyText);
      return [{
        createParagraphBullets: {
          range: withOptionalTabId(range, tabId),
          bulletPreset: operation.bulletPreset,
        },
      }];
    }
    case "deleteBullets": {
      const range = resolveRange(operation.target, bodyText);
      return [{
        deleteParagraphBullets: {
          range: withOptionalTabId(range, tabId),
        },
      }];
    }
  }
}

export async function editDocument(
  input: {
    documentId: string;
    operations: DocsEditOperation[];
    tabId?: string;
  },
  opts: { client: DocsClient },
) {
  for (const operation of input.operations) {
    const documentResponse = await opts.client.documents.get({
      documentId: input.documentId,
      includeTabsContent: Boolean(input.tabId),
    });
    const tab = resolveRequestedTab(documentResponse.data, input.tabId);
    const requests = buildRequestsForOperation(operation, {
      ...documentResponse.data,
      body: tab.body,
    }, tab.tabId);

    await opts.client.documents.batchUpdate({
      documentId: input.documentId,
      requestBody: {
        requests,
      },
    });
  }

  const updatedDocument = await opts.client.documents.get({
    documentId: input.documentId,
    includeTabsContent: Boolean(input.tabId),
  });
  const resolvedUpdatedTab = resolveRequestedTab(updatedDocument.data, input.tabId);

  return {
    documentId: updatedDocument.data.documentId ?? input.documentId,
    title: updatedDocument.data.title ?? "",
    text: extractDocumentText({
      ...updatedDocument.data,
      body: resolvedUpdatedTab.body,
    }),
    appliedOperations: input.operations.length,
    updated: true,
  };
}

export const docsEditTool = defineTool({
  moduleUrl: import.meta.url,
  name: "docs.edit",
  resource: "docs",
  capability: "update",
  description: "Apply surgical text edits and formatting changes to a Google Docs document.",
  destructive: true,
  updateMode: "granular",
  input: z.object({
    documentId: z.string().min(1).describe("The Google Docs document id."),
    tabId: z.string().min(1).optional().describe("Optional tab id to target within a multi-tab Google Doc."),
    operations: z.array(docsEditOperationSchema).min(1).describe(
      "Ordered edit operations. Use exact text targets for surgical edits, or explicit index ranges when you already know them.",
    ),
  }),
  output: z.object({
    documentId: z.string().optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    appliedOperations: z.number().int().nonnegative(),
    updated: z.boolean().optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const client = google.docs({
      version: "v1",
      auth: getGoogleAuth(),
    });

    return editDocument(input, { client });
  },
  onError: mapDocsEditError,
});

if (import.meta.main) {
  void runDeclaredTool(docsEditTool);
}
