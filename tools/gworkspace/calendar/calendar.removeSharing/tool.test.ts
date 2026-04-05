import assert from "node:assert/strict";
import test from "node:test";
import { calendarRemoveSharingTool, removeSharing, type CalendarClient } from "./tool.ts";

function createFakeClient() {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      acl: {
        delete: async (params: Record<string, unknown>) => {
          calls.push(params);
          return {};
        },
      },
    } as unknown as CalendarClient,
  };
}

test("removeSharing calls API and returns confirmation", async () => {
  const fake = createFakeClient();

  const result = await removeSharing({
    calendarId: "cal-1",
    ruleId: "user:alice@example.com",
  }, { client: fake.client });

  assert.deepEqual(result, { removed: true, ruleId: "user:alice@example.com" });
  assert.equal(fake.calls[0].calendarId, "cal-1");
  assert.equal(fake.calls[0].ruleId, "user:alice@example.com");
});

test("calendarRemoveSharingTool is marked destructive", () => {
  assert.equal(calendarRemoveSharingTool.destructive, true);
});
