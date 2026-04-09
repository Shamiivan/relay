import assert from "node:assert/strict";
import test from "node:test";
import { parseJsonInputText, sanitizeJsonText } from "./json-stdio.ts";

test("sanitizeJsonText escapes raw newlines inside JSON strings", () => {
  const raw = '{ "text": "line1\nline2" }';
  assert.equal(sanitizeJsonText(raw), '{ "text": "line1\\nline2" }');
});

test("parseJsonInputText accepts raw newlines inside JSON strings", () => {
  const raw = '{ "documentId": "doc-1", "operations": [{ "op": "insertText", "text": "line1\nline2", "location": { "kind": "start" } }] }';
  assert.deepEqual(parseJsonInputText(raw), {
    documentId: "doc-1",
    operations: [{
      op: "insertText",
      text: "line1\nline2",
      location: { kind: "start" },
    }],
  });
});

test("parseJsonInputText still rejects structurally invalid JSON", () => {
  assert.throws(() => parseJsonInputText('{ "text": "missing brace" '), SyntaxError);
});
