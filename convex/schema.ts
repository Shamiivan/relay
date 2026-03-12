/**
 * Convex schema for durable runs and event history.
 * Keep tables narrow and indexed by the queries we actually use.
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  runs: defineTable({
    userId: v.string(),
    channelId: v.string(),
    message: v.string(),
    specialistId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("finished"),
      v.literal("failed"),
    ),
    turnCount: v.number(),
    outputText: v.optional(v.string()),
    errorType: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    deliveryState: v.union(
      v.literal("queued"),
      v.literal("ready"),
      v.literal("sent"),
    ),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_delivery_state", ["deliveryState"]),

  events: defineTable({
    runId: v.id("runs"),
    kind: v.union(
      v.literal("user_message"),
      v.literal("tool_call"),
      v.literal("tool_result"),
      v.literal("agent_output"),
      v.literal("run_error"),
    ),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_run_created_at", ["runId", "createdAt"]),
});
