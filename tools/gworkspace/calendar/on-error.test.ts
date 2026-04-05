import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { calendarOnError } from "./on-error.ts";

function httpError(status: number, message: string) {
  const err = new Error(message);
  (err as Error & { status: number }).status = status;
  return err;
}

test("calendarOnError maps ZodError to validation", () => {
  const error = new z.ZodError([{
    code: "too_small", minimum: 1, inclusive: true, origin: "string",
    path: ["summary"], message: "Required",
  }]);
  assert.deepEqual(calendarOnError(error), { type: "validation", message: "Required" });
});

test("calendarOnError maps 400 to invalid_input", () => {
  assert.deepEqual(calendarOnError(httpError(400, "Bad Request")), {
    type: "invalid_input", message: "Bad Request",
  });
});

test("calendarOnError maps 401 to auth_error", () => {
  assert.deepEqual(calendarOnError(httpError(401, "Unauthorized")), {
    type: "auth_error", message: "Unauthorized",
  });
});

test("calendarOnError maps 403 to permission_denied", () => {
  assert.deepEqual(calendarOnError(httpError(403, "Forbidden: insufficient permissions")), {
    type: "permission_denied", message: "Forbidden: insufficient permissions",
  });
});

test("calendarOnError maps 404 to not_found", () => {
  assert.deepEqual(calendarOnError(httpError(404, "Not Found")), {
    type: "not_found", message: "Not Found",
  });
});

test("calendarOnError maps 409 to conflict_error", () => {
  assert.deepEqual(calendarOnError(httpError(409, "Resource already exists")), {
    type: "conflict_error", message: "Resource already exists",
  });
});

test("calendarOnError maps 410 to already_deleted", () => {
  assert.deepEqual(calendarOnError(httpError(410, "Gone")), {
    type: "already_deleted", message: "Gone",
  });
});

test("calendarOnError maps 429 to rate_limit_error", () => {
  assert.deepEqual(calendarOnError(httpError(429, "Too Many Requests")), {
    type: "rate_limit_error", message: "Too Many Requests",
  });
});

test("calendarOnError falls back to auth_error for token refresh failures", () => {
  assert.deepEqual(calendarOnError(new Error("invalid_grant: Token expired")), {
    type: "auth_error", message: "invalid_grant: Token expired",
  });
});

test("calendarOnError falls back to external_error for unknown errors", () => {
  assert.deepEqual(calendarOnError(new Error("Network timeout")), {
    type: "external_error", message: "Network timeout",
  });
});

test("calendarOnError handles non-Error objects", () => {
  assert.deepEqual(calendarOnError("string error"), {
    type: "external_error", message: "Unknown Calendar error",
  });
});
