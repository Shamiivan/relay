import assert from "node:assert/strict";
import test from "node:test";
import { buildWriteRequests, docsWriteTool, writeDocument } from "./tool.ts";

function createTabbedDocument() {
  return {
    documentId: "doc-1",
    title: "Working Doc",
    tabs: [
      {
        tabProperties: {
          tabId: "t.default",
          title: "Default",
        },
        documentTab: {
          body: {
            content: [{
              endIndex: 13,
              paragraph: {
                elements: [{ textRun: { content: "Default tab\n" } }],
              },
            }],
          },
        },
      },
      {
        tabProperties: {
          tabId: "t.board",
          title: "Board",
        },
        documentTab: {
          body: {
            content: [{
              endIndex: 11,
              paragraph: {
                elements: [{ textRun: { content: "Board tab\n" } }],
              },
            }],
          },
        },
      },
    ],
  };
}

test("buildWriteRequests scopes delete and insert to the requested tab", () => {
  const requests = buildWriteRequests({
    content: [{ endIndex: 11 }],
  }, "Updated\n", "t.board");

  assert.deepEqual(requests, [
    {
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: 10,
          tabId: "t.board",
        },
      },
    },
    {
      insertText: {
        location: {
          index: 1,
          tabId: "t.board",
        },
        text: "Updated\n",
      },
    },
  ]);
});

test("writeDocument fetches tabs and writes against the requested tab", async () => {
  const getCalls: Record<string, unknown>[] = [];
  const batchCalls: Record<string, unknown>[] = [];
  const client = {
    documents: {
      async get(args: Record<string, unknown>) {
        getCalls.push(args);
        return { data: createTabbedDocument() };
      },
      async batchUpdate(args: Record<string, unknown>) {
        batchCalls.push(args);
        return { data: {} };
      },
    },
  } as any;

  const result = await writeDocument({ documentId: "doc-1", tabId: "t.board", text: "Updated\n" }, { client });

  assert.equal(result.updated, true);
  assert.equal(getCalls[0]?.includeTabsContent, true);
  assert.deepEqual(
    ((batchCalls[0]?.requestBody as Record<string, unknown>)?.requests as Array<Record<string, unknown>>)[0],
    {
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: 10,
          tabId: "t.board",
        },
      },
    },
  );
});

test("docsWriteTool onError maps missing tab errors to not_found", () => {
  assert.deepEqual(
    docsWriteTool.onError?.(new Error("Tab not found: t.board")),
    { type: "not_found", message: "Tab not found: t.board", field: "tabId" },
  );
});
