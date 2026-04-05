import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarQuickAddEventTool, quickAddEvent, type CalendarClient } from "./tool.ts";

function createFakeClient() {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      events: {
        quickAdd: async (params: Record<string, unknown>) => {
          calls.push(params);
          return {
            data: {
              id: "quick-evt-1",
              summary: "Lunch with Alice",
              htmlLink: "https://calendar.google.com/event?eid=quick-evt-1",
              start: { dateTime: "2026-04-06T12:00:00-04:00" },
              end: { dateTime: "2026-04-06T13:00:00-04:00" },
            },
          };
        },
      },
    } as unknown as CalendarClient,
  };
}

test("quickAddEvent passes text to API and returns event", async () => {
  const fake = createFakeClient();

  const result = await quickAddEvent({
    text: "Lunch with Alice tomorrow at noon",
  }, { client: fake.client });

  assert.equal(result.id, "quick-evt-1");
  assert.equal(result.summary, "Lunch with Alice");
  assert.equal(fake.calls[0].text, "Lunch with Alice tomorrow at noon");
  assert.equal(fake.calls[0].calendarId, "primary");
  assert.equal(fake.calls[0].sendUpdates, "all");
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small", minimum: 1, inclusive: true, origin: "string",
    path: ["text"], message: "String must contain at least 1 character(s)",
  }]);
  assert.deepEqual(calendarQuickAddEventTool.onError?.(error), {
    type: "validation", message: "String must contain at least 1 character(s)",
  });
});
