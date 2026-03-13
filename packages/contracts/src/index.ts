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

/**
 * Runtime-facing shape for one model-callable action.
 */
export type ToolAction<TEnv = unknown, TResult = unknown> = {
  /** Stable model-visible action name. */
  name: string;
  /** Short description exposed to the model. */
  description: string;
  /** JSON schema exposed to the model provider. */
  parameters: Record<string, unknown>;
  /** Safety metadata used by runtime policy checks. */
  descriptor: ActionDescriptor;
  /** Optional trace helper for showing parsed or normalized input. */
  inspectInput?: (input: unknown) => unknown;
  /** Executes the action against the external system. */
  execute: (input: unknown, env: TEnv) => Promise<AdapterResult<TResult>>;
};

/**
 * Provider surface grouped by external system.
 */
export type ToolProvider<TEnv = unknown> = {
  /** Stable provider identifier such as gmail or gsheets. */
  id: string;
  /** Actions exposed by this provider. */
  actions: Record<string, ToolAction<TEnv>>;
};

export const specialistConfigSchema = z.object({
  id: z.string().min(1),
  promptFile: z.string().min(1),
  tools: z.array(z.string()).min(1),
  maxTurns: z.number().int().positive(),
  contextFiles: z.array(z.string()).default([]),
});

export type SpecialistConfig = z.infer<typeof specialistConfigSchema>;

/**
 * Google OAuth credentials shared by Google Workspace adapters.
 */
export type GoogleOAuthEnv = {
  /** OAuth client identifier. */
  GOOGLE_CLIENT_ID: string;
  /** OAuth client secret. */
  GOOGLE_CLIENT_SECRET: string;
  /** Refresh token for delegated Gmail access. */
  GOOGLE_REFRESH_TOKEN: string;
};

/**
 * Google credentials required by Gmail access.
 */
export type GmailEnv = GoogleOAuthEnv;

/**
 * Google credentials required by Google Sheets access.
 */
export type GSheetsEnv = GoogleOAuthEnv;

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

/**
 * Values returned from a Google Sheets range read.
 */
export type GSheetsReadValuesResult = {
  /** Spreadsheet identifier. */
  spreadsheetId: string;
  /** Resolved A1 range returned by Google Sheets. */
  range: string;
  /** Major dimension for the returned values. */
  majorDimension: "ROWS" | "COLUMNS";
  /** 2D array of cell values. */
  values: string[][];
};

/**
 * Result returned after appending a row to Google Sheets.
 */
export type GSheetsAppendRowResult = {
  /** Spreadsheet identifier. */
  spreadsheetId: string;
  /** Range that received the update. */
  updatedRange: string;
  /** Number of updated rows. */
  updatedRows: number;
  /** Number of updated columns. */
  updatedColumns: number;
  /** Number of updated cells. */
  updatedCells: number;
};
