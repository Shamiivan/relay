import assert from "node:assert/strict";
import test from "node:test";
import { docsReadTool, readDocument } from "./tool.ts";

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
    body: {
      content: [{
        endIndex: 13,
        paragraph: {
          elements: [{ textRun: { content: "Default tab\n" } }],
        },
      }],
    },
  };
}

test("readDocument returns the requested tab text", async () => {
  const getCalls: Record<string, unknown>[] = [];
  const client = {
    documents: {
      async get(args: Record<string, unknown>) {
        getCalls.push(args);
        return { data: createTabbedDocument() };
      },
    },
  } as any;

  const result = await readDocument({ documentId: "doc-1", tabId: "t.board" }, { client });

  assert.equal(result.text, "Board tab\n");
  assert.equal(getCalls[0]?.includeTabsContent, true);
});

test("readDocument can list tabs while still returning default tab text", async () => {
  const getCalls: Record<string, unknown>[] = [];
  const client = {
    documents: {
      async get(args: Record<string, unknown>) {
        getCalls.push(args);
        return { data: createTabbedDocument() };
      },
    },
  } as any;

  const result = await readDocument({ documentId: "doc-1", includeTabs: true }, { client });

  assert.equal(result.text, "Default tab\n");
  assert.equal(getCalls[0]?.includeTabsContent, true);
  assert.deepEqual(result.tabs, [
    { tabId: "t.default", title: "Default", index: 0 },
    { tabId: "t.board", title: "Board", index: 1 },
  ]);
});

test("docsReadTool onError maps missing tab errors to not_found", () => {
  assert.deepEqual(
    docsReadTool.onError?.(new Error("Tab not found: t.board")),
    { type: "not_found", message: "Tab not found: t.board", field: "tabId" },
  );
});
