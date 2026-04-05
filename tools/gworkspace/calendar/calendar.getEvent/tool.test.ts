import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarGetEventTool, getEvent, type CalendarClient } from "./tool.ts";

function createFakeClient(event: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      events: {
        get: async (params: Record<string, unknown>) => {
          calls.push(params);
          return { data: event };
        },
      },
    } as unknown as CalendarClient,
  };
}

test("getEvent returns full event details", async () => {
  const fake = createFakeClient({
    id: "evt-1",
    summary: "Standup",
    start: { dateTime: "2026-04-07T09:00:00-04:00" },
    end: { dateTime: "2026-04-07T09:30:00-04:00" },
    status: "confirmed",
    htmlLink: "https://calendar.google.com/event?eid=evt-1",
    creator: { email: "user@example.com" },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
    hangoutLink: "https://meet.google.com/abc-def",
  });

  const result = await getEvent({ eventId: "evt-1" }, { client: fake.client });

  assert.equal(result.id, "evt-1");
  assert.equal(result.summary, "Standup");
  assert.equal(result.creator?.email, "user@example.com");
  assert.equal(result.reminders?.useDefault, false);
  assert.equal(result.reminders?.overrides?.[0].minutes, 10);
  assert.equal(result.hangoutLink, "https://meet.google.com/abc-def");
  assert.equal(fake.calls[0].calendarId, "primary");
});

test("onError maps 404 to not_found", () => {
  const err = Object.assign(new Error("Not Found"), { status: 404 });
  assert.deepEqual(
    calendarGetEventTool.onError?.(err),
    { type: "not_found", message: "Not Found" },
  );
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small", minimum: 1, inclusive: true, origin: "string",
    path: ["eventId"], message: "String must contain at least 1 character(s)",
  }]);
  assert.deepEqual(calendarGetEventTool.onError?.(error), {
    type: "validation", message: "String must contain at least 1 character(s)",
  });
});
