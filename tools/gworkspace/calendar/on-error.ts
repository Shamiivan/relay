import { z } from "zod";
import type { ToolErrorInfo } from "../../sdk";

function getHttpStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error && typeof (error as { status: unknown }).status === "number") {
    return (error as { status: number }).status;
  }
  return undefined;
}

function msg(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Calendar error";
}

export function calendarOnError(error: unknown): ToolErrorInfo {
  if (error instanceof z.ZodError) {
    return { type: "validation", message: error.issues[0]?.message };
  }

  const status = getHttpStatus(error);
  if (status === 400) return { type: "invalid_input", message: msg(error) };
  if (status === 401) return { type: "auth_error", message: msg(error) };
  if (status === 403) return { type: "permission_denied", message: msg(error) };
  if (status === 404) return { type: "not_found", message: msg(error) };
  if (status === 409) return { type: "conflict_error", message: msg(error) };
  if (status === 410) return { type: "already_deleted", message: msg(error) };
  if (status === 429) return { type: "rate_limit_error", message: msg(error) };

  // fallback: auth regex for non-HTTP errors (e.g. token refresh failures)
  if (error instanceof Error && /auth|credential|token|invalid_grant/i.test(error.message)) {
    return { type: "auth_error", message: msg(error) };
  }

  return { type: "external_error", message: msg(error) };
}
