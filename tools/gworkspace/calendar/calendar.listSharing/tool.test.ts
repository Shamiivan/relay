import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarListSharingTool, listSharing, type CalendarClient } from "./tool.ts";

function createFakeClient(items: Record<string, unknown>[] = []) {
  return {
    acl: {
      list: async () => ({ data: { items } }),
    },
  } as unknown as CalendarClient;
}

test("listSharing returns ACL rules", async () => {
  const client = createFakeClient([
    { id: "user:alice@example.com", role: "reader", scope: { type: "user", value: "alice@example.com" } },
    { id: "user:bob@example.com", role: "writer", scope: { type: "user", value: "bob@example.com" } },
  ]);

  const result = await listSharing({ calendarId: "cal-1" }, { client });

  assert.equal(result.rules.length, 2);
  assert.equal(result.rules[0].role, "reader");
  assert.equal(result.rules[1].scope.value, "bob@example.com");
});

test("listSharing returns empty array when no rules", async () => {
  const client = createFakeClient([]);
  const result = await listSharing({ calendarId: "cal-1" }, { client });
  assert.equal(result.rules.length, 0);
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small", minimum: 1, inclusive: true, origin: "string",
    path: ["calendarId"], message: "String must contain at least 1 character(s)",
  }]);
  assert.deepEqual(calendarListSharingTool.onError?.(error), {
    type: "validation", message: "String must contain at least 1 character(s)",
  });
});
