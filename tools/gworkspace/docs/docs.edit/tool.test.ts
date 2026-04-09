import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  buildRequestsForOperation,
  docsEditTool,
  editDocument,
  type DocsClient,
  type DocsEditOperation,
} from "./tool.ts";

function createDocument(text: string) {
  return {
    documentId: "doc-1",
    title: "Working Doc",
    body: {
      content: [{
        endIndex: text.length + 1,
        paragraph: {
          elements: [{
            textRun: { content: text },
          }],
        },
      }],
    },
  };
}

function createFakeClient(initialText: string) {
  const batchCalls: Record<string, unknown>[] = [];
  let text = initialText;

  const client = {
    documents: {
      async get() {
        return { data: createDocument(text) };
      },
      async batchUpdate(args: Record<string, unknown>) {
        batchCalls.push(args);
        const requests = (((args.requestBody as Record<string, unknown> | undefined)?.requests) ?? []) as Array<Record<string, unknown>>;

        for (const request of requests) {
          if (request.deleteContentRange) {
            const range = (request.deleteContentRange as { range?: { startIndex?: number; endIndex?: number } }).range ?? {};
            const start = (range.startIndex ?? 1) - 1;
            const end = (range.endIndex ?? 1) - 1;
            text = text.slice(0, start) + text.slice(end);
          }

          if (request.insertText) {
            const insertText = request.insertText as { location?: { index?: number }; text?: string };
            const index = (insertText.location?.index ?? 1) - 1;
            text = text.slice(0, index) + (insertText.text ?? "") + text.slice(index);
          }

          if (request.replaceAllText) {
            const replaceAllText = request.replaceAllText as {
              containsText?: { text?: string; matchCase?: boolean };
              replaceText?: string;
            };
            const searchText = replaceAllText.containsText?.text ?? "";
            const replacement = replaceAllText.replaceText ?? "";

            if (replaceAllText.containsText?.matchCase === false) {
              const pattern = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
              text = text.replace(pattern, replacement);
            } else {
              text = text.split(searchText).join(replacement);
            }
          }
        }

        return { data: {} };
      },
    },
  } as unknown as DocsClient;

  return { client, batchCalls, getText: () => text };
}

function createTabbedDocument(tabs: Array<{ tabId: string; text: string; title?: string }>) {
  return {
    documentId: "doc-1",
    title: "Working Doc",
    tabs: tabs.map((tab) => ({
      tabProperties: {
        tabId: tab.tabId,
        title: tab.title ?? tab.tabId,
      },
      documentTab: {
        body: {
          content: [{
            endIndex: tab.text.length + 1,
            paragraph: {
              elements: [{
                textRun: { content: tab.text },
              }],
            },
          }],
        },
      },
    })),
  };
}

function createFakeTabbedClient(initialTabs: Array<{ tabId: string; text: string; title?: string }>) {
  const batchCalls: Record<string, unknown>[] = [];
  const getCalls: Record<string, unknown>[] = [];
  const tabs = new Map(initialTabs.map((tab) => [tab.tabId, { ...tab }]));

  const client = {
    documents: {
      async get(args: Record<string, unknown>) {
        getCalls.push(args);
        return {
          data: createTabbedDocument(Array.from(tabs.values())),
        };
      },
      async batchUpdate(args: Record<string, unknown>) {
        batchCalls.push(args);
        const requests = (((args.requestBody as Record<string, unknown> | undefined)?.requests) ?? []) as Array<Record<string, unknown>>;

        for (const request of requests) {
          if (request.deleteContentRange) {
            const range = (request.deleteContentRange as { range?: { startIndex?: number; endIndex?: number; tabId?: string } }).range ?? {};
            const tab = tabs.get(range.tabId ?? "");
            if (!tab) {
              continue;
            }
            const start = (range.startIndex ?? 1) - 1;
            const end = (range.endIndex ?? 1) - 1;
            tab.text = tab.text.slice(0, start) + tab.text.slice(end);
          }

          if (request.insertText) {
            const insertText = request.insertText as { location?: { index?: number; tabId?: string }; text?: string };
            const tab = tabs.get(insertText.location?.tabId ?? "");
            if (!tab) {
              continue;
            }
            const index = (insertText.location?.index ?? 1) - 1;
            tab.text = tab.text.slice(0, index) + (insertText.text ?? "") + tab.text.slice(index);
          }
        }

        return { data: {} };
      },
    },
  } as unknown as DocsClient;

  return {
    client,
    batchCalls,
    getCalls,
    getTabText: (tabId: string) => tabs.get(tabId)?.text,
  };
}

test("buildRequestsForOperation replaces the first text match surgically", () => {
  const requests = buildRequestsForOperation({
    op: "replaceText",
    target: { kind: "text", text: "draft", occurrence: 1, matchCase: true },
    replacement: "final",
    replaceAll: false,
  }, createDocument("draft plan\ndraft appendix\n"));

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], {
    deleteContentRange: {
      range: {
        startIndex: 1,
        endIndex: 6,
      },
    },
  });
  assert.deepEqual(requests[1], {
    insertText: {
      location: { index: 1 },
      text: "final",
    },
  });
});

test("buildRequestsForOperation inserts text after an anchor", () => {
  const requests = buildRequestsForOperation({
    op: "insertText",
    text: " final",
    location: { kind: "afterText", text: "Board", occurrence: 1, matchCase: true },
  }, createDocument("Board update\n"));

  assert.deepEqual(requests, [{
    insertText: {
      location: { index: 6 },
      text: " final",
    },
  }]);
});

test("buildRequestsForOperation stamps tabId on scoped requests", () => {
  const requests = buildRequestsForOperation({
    op: "insertText",
    text: " final",
    location: { kind: "afterText", text: "Board", occurrence: 1, matchCase: true },
  }, createDocument("Board update\n"), "t.board");

  assert.deepEqual(requests, [{
    insertText: {
      location: { index: 6, tabId: "t.board" },
      text: " final",
    },
  }]);
});

test("buildRequestsForOperation formats text with explicit fields", () => {
  const requests = buildRequestsForOperation({
    op: "formatText",
    target: { kind: "text", text: "Action required", occurrence: 1, matchCase: true },
    textStyle: {
      bold: true,
      foregroundColor: { red: 0.8, green: 0.1, blue: 0.1 },
    },
  }, createDocument("Action required\n"));

  assert.equal(requests.length, 1);
  const updateTextStyle = requests[0]?.updateTextStyle;
  assert.equal(updateTextStyle?.fields, "bold,foregroundColor");
  assert.equal(updateTextStyle?.range?.startIndex, 1);
  assert.equal(updateTextStyle?.range?.endIndex, 16);
});

test("buildRequestsForOperation throws target_not_found for missing anchor text", () => {
  assert.throws(
    () => buildRequestsForOperation({
      op: "insertText",
      text: " final",
      location: { kind: "afterText", text: "Missing", occurrence: 1, matchCase: true },
    }, createDocument("Board update\n")),
    (error: unknown) =>
      error instanceof Error
      && "type" in error
      && error.type === "target_not_found"
      && "field" in error
      && error.field === "location.text",
  );
});

test("buildRequestsForOperation throws invalid_range for out-of-bounds range", () => {
  assert.throws(
    () => buildRequestsForOperation({
      op: "deleteText",
      target: { kind: "range", startIndex: 1, endIndex: 999 },
    }, createDocument("Board update\n")),
    (error: unknown) =>
      error instanceof Error
      && "type" in error
      && error.type === "invalid_range"
      && "field" in error
      && error.field === "target.endIndex",
  );
});

test("editDocument applies operations in order", async () => {
  const fake = createFakeClient("Board draft\nNext line\n");
  const operations: DocsEditOperation[] = [
    {
      op: "replaceText",
      target: { kind: "text", text: "draft", occurrence: 1, matchCase: true },
      replacement: "final",
      replaceAll: false,
    },
    {
      op: "insertText",
      text: " status",
      location: { kind: "afterText", text: "Board final", occurrence: 1, matchCase: true },
    },
  ];

  const result = await editDocument({
    documentId: "doc-1",
    operations,
  }, {
    client: fake.client,
  });

  assert.equal(result.appliedOperations, 2);
  assert.equal(fake.getText(), "Board final status\nNext line\n");
  assert.equal(fake.batchCalls.length, 2);
});

test("editDocument targets the requested tab", async () => {
  const fake = createFakeTabbedClient([
    { tabId: "t.default", text: "Default tab\n" },
    { tabId: "t.board", text: "Board draft\n" },
  ]);

  const result = await editDocument({
    documentId: "doc-1",
    tabId: "t.board",
    operations: [{
      op: "replaceText",
      target: { kind: "text", text: "draft", occurrence: 1, matchCase: true },
      replacement: "final",
      replaceAll: false,
    }],
  }, {
    client: fake.client,
  });

  assert.equal(result.text, "Board final\n");
  assert.equal(fake.getTabText("t.default"), "Default tab\n");
  assert.equal(fake.getTabText("t.board"), "Board final\n");
  assert.equal(fake.getCalls[0]?.includeTabsContent, true);
  assert.equal(
    ((((fake.batchCalls[0]?.requestBody as Record<string, unknown>)?.requests as Array<Record<string, unknown>>)[0]?.deleteContentRange as {
      range?: { tabId?: string };
    })?.range?.tabId),
    "t.board",
  );
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "custom",
    path: ["operations", 0],
    message: "Operation is invalid",
  }]);
  assert.deepEqual(docsEditTool.onError?.(error), {
    type: "validation",
    message: "Operation is invalid",
    field: "operations.0",
  });
});

test("onError maps auth errors to auth_error", () => {
  assert.deepEqual(
    docsEditTool.onError?.(new Error("invalid_grant: Token has been expired")),
    { type: "auth_error", message: "invalid_grant: Token has been expired" },
  );
});

test("onError maps missing tab errors to not_found", () => {
  assert.deepEqual(
    docsEditTool.onError?.(new Error("Tab not found: t.board")),
    { type: "not_found", message: "Tab not found: t.board", field: "tabId" },
  );
});

test("onError maps plain anchor miss messages to target_not_found", () => {
  assert.deepEqual(
    docsEditTool.onError?.(new Error("Target text not found: Missing")),
    { type: "target_not_found", message: "Target text not found: Missing", field: "target.text" },
  );
});

test("onError maps local resolution errors with field metadata", () => {
  let resolutionError: unknown;

  try {
    buildRequestsForOperation({
      op: "insertText",
      text: " final",
      location: { kind: "afterText", text: "Missing", occurrence: 1, matchCase: true },
    }, createDocument("Board update\n"));
  } catch (error) {
    resolutionError = error;
  }

  assert.deepEqual(docsEditTool.onError?.(resolutionError), {
    type: "target_not_found",
    message: "Insert anchor not found: Missing",
    field: "location.text",
  });
});

test("onError maps quota failures to rate_limit", () => {
  assert.deepEqual(
    docsEditTool.onError?.(new Error("429 quota exceeded for quota metric 'Read requests'")),
    { type: "rate_limit", message: "429 quota exceeded for quota metric 'Read requests'" },
  );
});

test("onError maps permission failures to permission_denied", () => {
  assert.deepEqual(
    docsEditTool.onError?.(new Error("403 The caller does not have permission")),
    { type: "permission_denied", message: "403 The caller does not have permission" },
  );
});
