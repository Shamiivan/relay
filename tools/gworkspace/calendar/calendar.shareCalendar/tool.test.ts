import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarShareCalendarTool, shareCalendar, type CalendarClient } from "./tool.ts";

function createFakeClient() {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      acl: {
        insert: async (params: Record<string, unknown>) => {
          calls.push(params);
          const body = params.requestBody as Record<string, unknown>;
          return {
            data: {
              id: "user:alice@example.com",
              role: body.role,
              scope: body.scope,
            },
          };
        },
      },
    } as unknown as CalendarClient,
  };
}

test("shareCalendar grants access and returns ACL rule", async () => {
  const fake = createFakeClient();

  const result = await shareCalendar({
    calendarId: "shamiivan@gmail.com",
    email: "alice@example.com",
    role: "reader",
  }, { client: fake.client });

  assert.equal(result.id, "user:alice@example.com");
  assert.equal(result.role, "reader");
  assert.equal(result.scope.type, "user");
  assert.equal(result.scope.value, "alice@example.com");
  assert.equal(fake.calls[0].sendNotifications, true);
});

test("shareCalendar passes sendNotifications false", async () => {
  const fake = createFakeClient();

  await shareCalendar({
    calendarId: "cal-1",
    email: "bob@example.com",
    role: "writer",
    sendNotifications: false,
  }, { client: fake.client });

  assert.equal(fake.calls[0].sendNotifications, false);
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small", minimum: 1, inclusive: true, origin: "string",
    path: ["calendarId"], message: "String must contain at least 1 character(s)",
  }]);
  assert.deepEqual(calendarShareCalendarTool.onError?.(error), {
    type: "validation", message: "String must contain at least 1 character(s)",
  });
});
