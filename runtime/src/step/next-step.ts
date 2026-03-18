import type { ThreadData } from "../thread.ts";

export type NextStep =
  | { type: "done_for_now"; message: string }
  | { type: "request_human_clarification"; prompt: string }
  | { type: "request_human_approval"; prompt: string }
  | { type: "executable"; executableName: string; args: ThreadData };
