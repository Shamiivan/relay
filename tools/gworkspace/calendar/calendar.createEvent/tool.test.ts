import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarCreateEventTool, createEvent, type CalendarClient } from "./tool.ts";

function createFakeClient() {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      events: {
        insert: async (params: Record<string, unknown>) => {
          calls.push(params);
          const body = params.requestBody as Record<string, unknown>;
          return {
            data: {
              id: "new-evt-1",
              summary: body.summary,
              htmlLink: "https://calendar.google.com/event?eid=new-evt-1",
              start: body.start,
              end: body.end,
              attendees: (body.attendees as { email: string }[] | undefined)?.map((a) => ({
                email: a.email,
                responseStatus: "needsAction",
              })),
              hangoutLink: undefined,
            },
          };
        },
      },
    } as unknown as CalendarClient,
  };
}

test("createEvent creates a timed event", async () => {
  const fake = createFakeClient();

  const result = await createEvent({
    summary: "Team Standup",
    start: { dateTime: "2026-04-07T09:00:00-04:00" },
    end: { dateTime: "2026-04-07T09:30:00-04:00" },
  }, { client: fake.client });

  assert.equal(result.id, "new-evt-1");
  assert.equal(result.summary, "Team Standup");
  assert.equal(result.start.dateTime, "2026-04-07T09:00:00-04:00");

  assert.equal(fake.calls[0].calendarId, "primary");
  assert.equal(fake.calls[0].sendUpdates, "all");
});

test("createEvent passes attendees to the API", async () => {
  const fake = createFakeClient();

  const result = await createEvent({
    summary: "Meeting",
    start: { dateTime: "2026-04-07T14:00:00Z" },
    end: { dateTime: "2026-04-07T15:00:00Z" },
    attendees: [
      { email: "alice@example.com" },
      { email: "bob@example.com", optional: true },
    ],
  }, { client: fake.client });

  assert.equal(result.attendees?.length, 2);
  assert.equal(result.attendees?.[0].email, "alice@example.com");

  const body = fake.calls[0].requestBody as Record<string, unknown>;
  const sentAttendees = body.attendees as { email: string; optional?: boolean }[];
  assert.equal(sentAttendees.length, 2);
  assert.equal(sentAttendees[1].optional, true);
});

test("createEvent passes reminders to the API", async () => {
  const fake = createFakeClient();

  await createEvent({
    summary: "Important",
    start: { dateTime: "2026-04-07T10:00:00Z" },
    end: { dateTime: "2026-04-07T11:00:00Z" },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
  }, { client: fake.client });

  const body = fake.calls[0].requestBody as Record<string, unknown>;
  const reminders = body.reminders as { useDefault: boolean; overrides: unknown[] };
  assert.equal(reminders.useDefault, false);
  assert.equal(reminders.overrides.length, 1);
});

test("createEvent creates an all-day event", async () => {
  const fake = createFakeClient();

  const result = await createEvent({
    summary: "Holiday",
    start: { date: "2026-04-07" },
    end: { date: "2026-04-08" },
  }, { client: fake.client });

  assert.equal(result.start.date, "2026-04-07");
  assert.equal(result.end.date, "2026-04-08");
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small", minimum: 1, inclusive: true, origin: "string",
    path: ["summary"], message: "String must contain at least 1 character(s)",
  }]);
  assert.deepEqual(calendarCreateEventTool.onError?.(error), {
    type: "validation", message: "String must contain at least 1 character(s)",
  });
});
