import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarListEventsTool, listEvents, type CalendarClient } from "./tool.ts";

function createFakeClient(items: Record<string, unknown>[] = []): CalendarClient {
  const calls: Record<string, unknown>[] = [];
  return {
    events: {
      list: async (params: Record<string, unknown>) => {
        calls.push(params);
        return { data: { items } };
      },
    },
    _calls: calls,
  } as unknown as CalendarClient & { _calls: Record<string, unknown>[] };
}

test("listEvents returns mapped events", async () => {
  const client = createFakeClient([
    {
      id: "evt-1",
      summary: "Standup",
      start: { dateTime: "2026-04-05T09:00:00-04:00" },
      end: { dateTime: "2026-04-05T09:30:00-04:00" },
      status: "confirmed",
      htmlLink: "https://calendar.google.com/event?eid=evt-1",
    },
  ]);

  const result = await listEvents({}, { client });

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].id, "evt-1");
  assert.equal(result.events[0].summary, "Standup");
  assert.equal(result.events[0].start.dateTime, "2026-04-05T09:00:00-04:00");
});

test("listEvents defaults calendarId to primary and singleEvents to true", async () => {
  const calls: Record<string, unknown>[] = [];
  const client = {
    events: {
      list: async (params: Record<string, unknown>) => {
        calls.push(params);
        return { data: { items: [] } };
      },
    },
  } as unknown as CalendarClient;

  await listEvents({}, { client });

  assert.equal(calls[0].calendarId, "primary");
  assert.equal(calls[0].singleEvents, true);
  assert.equal(calls[0].orderBy, "startTime");
});

test("listEvents passes query and date filters", async () => {
  const calls: Record<string, unknown>[] = [];
  const client = {
    events: {
      list: async (params: Record<string, unknown>) => {
        calls.push(params);
        return { data: { items: [] } };
      },
    },
  } as unknown as CalendarClient;

  await listEvents({
    calendarId: "work",
    timeMin: "2026-04-01T00:00:00Z",
    timeMax: "2026-04-07T00:00:00Z",
    query: "standup",
    maxResults: 5,
  }, { client });

  assert.equal(calls[0].calendarId, "work");
  assert.equal(calls[0].timeMin, "2026-04-01T00:00:00Z");
  assert.equal(calls[0].timeMax, "2026-04-07T00:00:00Z");
  assert.equal(calls[0].q, "standup");
  assert.equal(calls[0].maxResults, 5);
});

test("listEvents returns empty array when no events", async () => {
  const client = createFakeClient([]);
  const result = await listEvents({}, { client });
  assert.equal(result.events.length, 0);
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "invalid_type", expected: "string",
    path: ["calendarId"], message: "Expected string",
  }]);
  assert.deepEqual(calendarListEventsTool.onError?.(error), {
    type: "validation", message: "Expected string",
  });
});
