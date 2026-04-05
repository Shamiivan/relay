import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarFreebusyTool, queryFreebusy, type CalendarClient } from "./tool.ts";

function createFakeClient(calendars: Record<string, { busy: { start: string; end: string }[] }>) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      freebusy: {
        query: async (params: Record<string, unknown>) => {
          calls.push(params);
          return { data: { calendars } };
        },
      },
    } as unknown as CalendarClient,
  };
}

test("queryFreebusy returns busy times for calendars", async () => {
  const fake = createFakeClient({
    primary: {
      busy: [
        { start: "2026-04-06T14:00:00Z", end: "2026-04-06T15:00:00Z" },
      ],
    },
    "bob@example.com": { busy: [] },
  });

  const result = await queryFreebusy({
    timeMin: "2026-04-06T13:00:00Z",
    timeMax: "2026-04-06T17:00:00Z",
    items: [{ id: "primary" }, { id: "bob@example.com" }],
  }, { client: fake.client });

  assert.equal(result.calendars["primary"].busy.length, 1);
  assert.equal(result.calendars["primary"].busy[0].start, "2026-04-06T14:00:00Z");
  assert.equal(result.calendars["bob@example.com"].busy.length, 0);
});

test("queryFreebusy passes timeZone to API", async () => {
  const fake = createFakeClient({});

  await queryFreebusy({
    timeMin: "2026-04-06T13:00:00Z",
    timeMax: "2026-04-06T17:00:00Z",
    items: [{ id: "primary" }],
    timeZone: "America/Toronto",
  }, { client: fake.client });

  const body = (fake.calls[0].requestBody as Record<string, unknown>);
  assert.equal(body.timeZone, "America/Toronto");
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small", minimum: 1, inclusive: true, origin: "number",
    path: ["items"], message: "Array must contain at least 1 element(s)",
  }]);
  assert.deepEqual(calendarFreebusyTool.onError?.(error), {
    type: "validation", message: "Array must contain at least 1 element(s)",
  });
});
