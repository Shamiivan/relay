/**
 * Shared contract types for adapters and policy.
 * These types keep tool boundaries small and explicit.
 */
import { z } from "zod";

/**
 * High-level access scope for an action.
 */
export type ActionScope = "read" | "write" | "send" | "schedule" | "admin";

/**
 * Extra safety markers attached to an action.
 */
export type ActionFlag = "external" | "irreversible" | "bulk";

/**
 * Metadata used by policy to evaluate a tool action.
 */
export type ActionDescriptor = {
  /** Stable tool identifier such as gmail. */
  tool: string;
  /** Operation name within the tool surface. */
  operation: string;
  /** Broad permission scope for the action. */
  scope: ActionScope;
  /** Optional safety markers for extra review rules. */
  flags?: ActionFlag[];
};

/**
 * Named error union returned by adapters.
 */
export type NamedError =
  /** Authentication or token failure. */
  | { type: "auth_error" }
  /** Provider rate limit with retry guidance. */
  | { type: "rate_limit"; retryAfterMs: number }
  /** Missing external resource. */
  | { type: "not_found"; id: string }
  /** Input failed validation at the boundary. */
  | { type: "validation"; field: string; reason: string }
  /** Write could not complete because of conflicting state. */
  | { type: "conflict"; detail: string }
  /** Catch-all external provider failure. */
  | { type: "external_error"; message: string };

/**
 * Standard adapter result shape.
 */
export type AdapterResult<T = unknown> =
  /** Successful adapter response with typed data. */
  | { ok: true; data: T }
  /** Failed adapter response with a named error. */
  | { ok: false; error: NamedError };

export const specialistConfigSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).optional(),
  promptFile: z.string().min(1),
  triggers: z.array(z.string()).default([]),
  tools: z.array(z.string()).min(1),
  maxTurns: z.number().int().positive(),
  contextFiles: z.array(z.string()).default([]),
});

export type SpecialistConfig = z.infer<typeof specialistConfigSchema>;

/**
 * Google credentials required by Gmail access.
 */
export type GmailEnv = {
  /** OAuth client identifier. */
  GOOGLE_CLIENT_ID: string;
  /** OAuth client secret. */
  GOOGLE_CLIENT_SECRET: string;
  /** Refresh token for delegated Gmail access. */
  GOOGLE_REFRESH_TOKEN: string;
};

/**
 * Minimal email summary returned by Gmail search.
 */
export type GmailEmailSummary = {
  /** Gmail message identifier. */
  id: string;
  /** Gmail conversation thread identifier. */
  threadId: string;
  /** Message subject line. */
  subject: string;
  /** Sender display name or email. */
  from: string;
  /** Provider date header. */
  date: string;
  /** Short Gmail snippet for quick review. */
  snippet: string;
  /** Whether the message is currently unread. */
  unread: boolean;
};

/**
 * Search result returned by the Gmail adapter.
 */
export type GmailSearchResult = {
  /** Matching email summaries. */
  emails: GmailEmailSummary[];
  /** Estimated total matches from Gmail. */
  total: number;
};

/**
 * Full message shape returned by Gmail read.
 */
export type GmailMessage = {
  /** Gmail message identifier. */
  id: string;
  /** Gmail conversation thread identifier. */
  threadId: string;
  /** Message subject line. */
  subject: string;
  /** Sender display name or email. */
  from: string;
  /** Recipient header. */
  to: string;
  /** Provider date header. */
  date: string;
  /** Extracted text body. */
  body: string;
  /** Gmail labels attached to the message. */
  labels: string[];
};
