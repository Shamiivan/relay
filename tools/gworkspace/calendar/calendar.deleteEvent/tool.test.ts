import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarDeleteEventTool, deleteEvent, type CalendarClient } from "./tool.ts";

function createFakeClient() {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      events: {
        delete: async (params: Record<string, unknown>) => {
          calls.push(params);
          return {};
        },
      },
    } as unknown as CalendarClient,
  };
}

test("deleteEvent calls API and returns confirmation", async () => {
  const fake = createFakeClient();

  const result = await deleteEvent({ eventId: "evt-1" }, { client: fake.client });

  assert.deepEqual(result, { deleted: true, eventId: "evt-1" });
  assert.equal(fake.calls[0].calendarId, "primary");
  assert.equal(fake.calls[0].eventId, "evt-1");
  assert.equal(fake.calls[0].sendUpdates, "all");
});

test("deleteEvent passes sendUpdates none", async () => {
  const fake = createFakeClient();

  await deleteEvent({ eventId: "evt-1", sendUpdates: "none" }, { client: fake.client });

  assert.equal(fake.calls[0].sendUpdates, "none");
});

test("onError maps 404 to not_found", () => {
  const err = Object.assign(new Error("Not Found"), { status: 404 });
  assert.deepEqual(
    calendarDeleteEventTool.onError?.(err),
    { type: "not_found", message: "Not Found" },
  );
});

test("calendarDeleteEventTool is marked destructive", () => {
  assert.equal(calendarDeleteEventTool.destructive, true);
});
