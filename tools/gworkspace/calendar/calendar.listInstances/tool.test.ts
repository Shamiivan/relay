import assert from "node:assert/strict";
import test from "node:test";
import { listInstances, type CalendarClient } from "./tool.ts";

function createFakeClient(items: Record<string, unknown>[] = []) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      events: {
        instances: async (params: Record<string, unknown>) => {
          calls.push(params);
          return { data: { items } };
        },
      },
    } as unknown as CalendarClient,
  };
}

test("listInstances returns expanded recurring event instances", async () => {
  const fake = createFakeClient([
    { id: "evt-1_20260407", summary: "Weekly Standup", start: { dateTime: "2026-04-07T09:00:00Z" }, end: { dateTime: "2026-04-07T09:30:00Z" } },
    { id: "evt-1_20260414", summary: "Weekly Standup", start: { dateTime: "2026-04-14T09:00:00Z" }, end: { dateTime: "2026-04-14T09:30:00Z" } },
  ]);

  const result = await listInstances({ eventId: "evt-1" }, { client: fake.client });

  assert.equal(result.instances.length, 2);
  assert.equal(result.instances[0].id, "evt-1_20260407");
  assert.equal(result.instances[1].id, "evt-1_20260414");
  assert.equal(fake.calls[0].calendarId, "primary");
  assert.equal(fake.calls[0].maxResults, 25);
});

test("listInstances passes time bounds", async () => {
  const fake = createFakeClient([]);

  await listInstances({
    eventId: "evt-1",
    timeMin: "2026-04-01T00:00:00Z",
    timeMax: "2026-04-30T00:00:00Z",
  }, { client: fake.client });

  assert.equal(fake.calls[0].timeMin, "2026-04-01T00:00:00Z");
  assert.equal(fake.calls[0].timeMax, "2026-04-30T00:00:00Z");
});
