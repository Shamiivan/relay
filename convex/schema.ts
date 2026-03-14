/**
 * Convex schema for durable runs and event history.
 * Keep tables narrow and indexed by the queries we actually use.
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  threads: defineTable({
    userId: v.string(),
    channelId: v.string(),
    specialistId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_channel_user_specialist", ["channelId", "userId", "specialistId"]),

  runs: defineTable({
    threadId: v.id("threads"),
    userId: v.string(),
    channelId: v.string(),
    message: v.string(),
    specialistId: v.string(),
    status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
    turnCount: v.number(),
    outcome: v.optional(
      v.union(
        v.literal("success"),
        v.literal("error"),
        v.literal("cancelled"),
      ),
    ),
    waitingOn: v.optional(v.union(v.literal("none"), v.literal("human"))),
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
    .index("by_delivery_state", ["deliveryState"])
    .index("by_thread", ["threadId"]),

  threadMessages: defineTable({
    threadId: v.id("threads"),
    runId: v.id("runs"),
    kind: v.union(v.literal("user_message"), v.literal("assistant_message")),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_thread_created_at", ["threadId", "createdAt"])
    .index("by_run_created_at", ["runId", "createdAt"]),

  runSteps: defineTable({
    runId: v.id("runs"),
    threadId: v.id("threads"),
    index: v.number(),
    kind: v.union(v.literal("model"), v.literal("tool")),
    status: v.union(v.literal("started"), v.literal("completed"), v.literal("failed")),
    inputJson: v.string(),
    outputJson: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_run_index", ["runId", "index"])
    .index("by_thread_created_at", ["threadId", "createdAt"]),
});
