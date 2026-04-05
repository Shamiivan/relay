import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarListCalendarsTool, listCalendars, type CalendarClient } from "./tool.ts";

function createFakeClient(items: Record<string, unknown>[] = []): CalendarClient {
  return {
    calendarList: {
      list: async () => ({
        data: { items, nextPageToken: null },
      }),
    },
  } as unknown as CalendarClient;
}

test("listCalendars returns calendars from the API", async () => {
  const client = createFakeClient([
    { id: "primary-id", summary: "My Calendar", primary: true, accessRole: "owner", timeZone: "America/Montreal" },
    { id: "work-id", summary: "Work", accessRole: "reader" },
  ]);

  const result = await listCalendars({}, { client });

  assert.equal(result.calendars.length, 2);
  assert.equal(result.calendars[0].id, "primary-id");
  assert.equal(result.calendars[0].primary, true);
  assert.equal(result.calendars[1].id, "work-id");
  assert.equal(result.calendars[1].primary, undefined);
});

test("listCalendars returns empty array when no calendars exist", async () => {
  const client = createFakeClient([]);
  const result = await listCalendars({}, { client });
  assert.equal(result.calendars.length, 0);
});

test("listCalendars respects maxResults", async () => {
  const items = Array.from({ length: 5 }, (_, i) => ({
    id: `cal-${i}`, summary: `Cal ${i}`, accessRole: "owner",
  }));
  const client = createFakeClient(items);

  const result = await listCalendars({ maxResults: 2 }, { client });
  assert.equal(result.calendars.length, 2);
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small", minimum: 1, inclusive: true, origin: "number",
    path: ["maxResults"], message: "Number must be >= 1",
  }]);
  assert.deepEqual(calendarListCalendarsTool.onError?.(error), {
    type: "validation", message: "Number must be >= 1",
  });
});

test("onError maps auth errors to auth_error", () => {
  assert.deepEqual(
    calendarListCalendarsTool.onError?.(new Error("invalid_grant: Token has been expired")),
    { type: "auth_error", message: "invalid_grant: Token has been expired" },
  );
});

test("onError maps unknown errors to external_error", () => {
  assert.deepEqual(
    calendarListCalendarsTool.onError?.(new Error("Network timeout")),
    { type: "external_error", message: "Network timeout" },
  );
});
