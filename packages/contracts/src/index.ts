/**
 * Shared contract types for adapters and policy.
 * These types keep tool boundaries small and explicit.
 */
export type ActionScope = "read" | "write" | "send" | "schedule" | "admin";

export type ActionFlag = "external" | "irreversible" | "bulk";

export type ActionDescriptor = {
  tool: string;
  operation: string;
  scope: ActionScope;
  flags?: ActionFlag[];
};

export type NamedError =
  | { type: "auth_error" }
  | { type: "rate_limit"; retryAfterMs: number }
  | { type: "not_found"; id: string }
  | { type: "validation"; field: string; reason: string }
  | { type: "conflict"; detail: string }
  | { type: "external_error"; message: string };

export type AdapterResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: NamedError };
