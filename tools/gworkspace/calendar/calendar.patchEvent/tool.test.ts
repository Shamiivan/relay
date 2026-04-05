import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarPatchEventTool, patchEvent, type CalendarClient } from "./tool.ts";

function createFakeClient() {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      events: {
        patch: async (params: Record<string, unknown>) => {
          calls.push(params);
          const body = params.requestBody as Record<string, unknown>;
          return {
            data: {
              id: params.eventId,
              summary: body.summary ?? "Original Title",
              htmlLink: `https://calendar.google.com/event?eid=${params.eventId}`,
              start: body.start ?? { dateTime: "2026-04-07T09:00:00Z" },
              end: body.end ?? { dateTime: "2026-04-07T10:00:00Z" },
              attendees: body.attendees ? (body.attendees as { email: string }[]).map((a) => ({
                email: a.email,
                responseStatus: "needsAction",
              })) : undefined,
            },
          };
        },
      },
    } as unknown as CalendarClient,
  };
}

test("patchEvent sends only provided fields", async () => {
  const fake = createFakeClient();

  await patchEvent({
    eventId: "evt-1",
    summary: "Updated Title",
  }, { client: fake.client });

  const body = fake.calls[0].requestBody as Record<string, unknown>;
  assert.equal(body.summary, "Updated Title");
  assert.equal(body.start, undefined);
  assert.equal(body.end, undefined);
  assert.equal(body.description, undefined);
  assert.equal(body.location, undefined);
  assert.equal(body.attendees, undefined);
});

test("patchEvent passes attendees as full replacement", async () => {
  const fake = createFakeClient();

  const result = await patchEvent({
    eventId: "evt-1",
    attendees: [
      { email: "alice@example.com" },
      { email: "bob@example.com", optional: true },
    ],
  }, { client: fake.client });

  const body = fake.calls[0].requestBody as Record<string, unknown>;
  const sentAttendees = body.attendees as { email: string; optional?: boolean }[];
  assert.equal(sentAttendees.length, 2);
  assert.equal(sentAttendees[1].optional, true);
  assert.equal(result.attendees?.length, 2);
});

test("patchEvent defaults to primary calendar and sendUpdates all", async () => {
  const fake = createFakeClient();

  await patchEvent({
    eventId: "evt-1",
    summary: "Test",
  }, { client: fake.client });

  assert.equal(fake.calls[0].calendarId, "primary");
  assert.equal(fake.calls[0].sendUpdates, "all");
});

test("onError maps not found to not_found", () => {
  const err = Object.assign(new Error("Not Found"), { status: 404 });
  assert.deepEqual(
    calendarPatchEventTool.onError?.(err),
    { type: "not_found", message: "Not Found" },
  );
});

test("onError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small", minimum: 1, inclusive: true, origin: "string",
    path: ["eventId"], message: "String must contain at least 1 character(s)",
  }]);
  assert.deepEqual(calendarPatchEventTool.onError?.(error), {
    type: "validation", message: "String must contain at least 1 character(s)",
  });
});
