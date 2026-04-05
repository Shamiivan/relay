import assert from "node:assert/strict";
import test from "node:test";
import { moveEvent, type CalendarClient } from "./tool.ts";

function createFakeClient() {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      events: {
        move: async (params: Record<string, unknown>) => {
          calls.push(params);
          return {
            data: {
              id: params.eventId,
              summary: "Moved Event",
              htmlLink: "https://calendar.google.com/event?eid=moved",
              start: { dateTime: "2026-04-07T09:00:00Z" },
              end: { dateTime: "2026-04-07T10:00:00Z" },
            },
          };
        },
      },
    } as unknown as CalendarClient,
  };
}

test("moveEvent calls API with correct params", async () => {
  const fake = createFakeClient();

  const result = await moveEvent({
    eventId: "evt-1",
    destinationCalendarId: "work-cal",
  }, { client: fake.client });

  assert.equal(result.id, "evt-1");
  assert.equal(result.summary, "Moved Event");
  assert.equal(fake.calls[0].calendarId, "primary");
  assert.equal(fake.calls[0].destination, "work-cal");
  assert.equal(fake.calls[0].sendUpdates, "all");
});
