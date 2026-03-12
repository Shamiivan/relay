/**
 * Policy decides whether an action is allowed, confirmed, or blocked.
 * Keep decisions deterministic and separate from model behavior.
 */
import type { ActionDescriptor } from "../../contracts/src";

export type PolicyDecision = "allow" | "confirm" | "block";

export function check(descriptor: ActionDescriptor): PolicyDecision {
  if (descriptor.tool === "gmail" && descriptor.operation === "send") {
    return "confirm";
  }

  if (descriptor.scope === "admin") {
    return "confirm";
  }

  return "allow";
}
