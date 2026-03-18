/**
 * Convex schema for durable runs and event history.
 * Keep tables narrow and indexed by the queries we actually use.
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const transportValidator = v.union(
  v.literal("discord"),
  v.literal("cli"),
  v.literal("tui"),
);

export default defineSchema({
  sessions: defineTable({
    userId: v.string(),
    threadKey: v.optional(v.string()),
    channelId: v.optional(v.string()),
    transport: v.optional(transportValidator),
    specialistId: v.string(),
    activeWorkflowName: v.optional(v.string()),
    workflowStateJson: v.optional(v.string()),
    workflowStepName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_thread_user_specialist", ["threadKey", "userId", "specialistId"]),

  runs: defineTable({
    sessionId: v.id("sessions"),
    userId: v.string(),
    threadKey: v.optional(v.string()),
    channelId: v.optional(v.string()),
    transport: v.optional(transportValidator),
    message: v.string(),
    specialistId: v.string(),
    executionMode: v.union(v.literal("open_loop"), v.literal("workflow")),
    workflowName: v.optional(v.string()),
    workflowVersion: v.optional(v.number()),
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
    .index("by_session", ["sessionId"]),

  toolCalls: defineTable({
    runId: v.id("runs"),
    sessionId: v.id("sessions"),
    runStepId: v.optional(v.id("runSteps")),
    index: v.number(),
    toolName: v.string(),
    toolKind: v.union(v.literal("machine"), v.literal("human")),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    argsJson: v.string(),
    pendingRequestJson: v.optional(v.string()),
    resultJson: v.optional(v.string()),
    errorType: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_run_index", ["runId", "index"])
    .index("by_run_status", ["runId", "status"])
    .index("by_session_started_at", ["sessionId", "startedAt"]),

  events: defineTable({
    sessionId: v.id("sessions"),
    runId: v.optional(v.id("runs")),
    runStepId: v.optional(v.id("runSteps")),
    toolCallId: v.optional(v.id("toolCalls")),
    kind: v.string(),
    dataJson: v.string(),
    createdAt: v.number(),
  })
    .index("by_run_created_at", ["runId", "createdAt"])
    .index("by_session_created_at", ["sessionId", "createdAt"]),

  sessionMessages: defineTable({
    sessionId: v.id("sessions"),
    runId: v.id("runs"),
    kind: v.union(v.literal("user_message"), v.literal("assistant_message")),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_session_created_at", ["sessionId", "createdAt"])
    .index("by_run_created_at", ["runId", "createdAt"]),

  runSteps: defineTable({
    runId: v.id("runs"),
    sessionId: v.id("sessions"),
    index: v.number(),
    kind: v.union(
      v.literal("model_response"),
      v.literal("tool_execution"),
      v.literal("workflow_step"),
      v.literal("finalize"),
    ),
    status: v.union(v.literal("started"), v.literal("completed"), v.literal("failed")),
    schemaVersion: v.number(),
    modelRequestJson: v.optional(v.string()),
    modelResponseJson: v.optional(v.string()),
    toolRequestsJson: v.optional(v.string()),
    toolResultsJson: v.optional(v.string()),
    summaryText: v.optional(v.string()),
    errorType: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_run_index", ["runId", "index"])
    .index("by_session_created_at", ["sessionId", "createdAt"]),

  plan: defineTable({
    sessionId: v.id("sessions"),
    runId: v.id("runs"),
    platform: v.string(),
    prompt: v.string(),
    status: v.union(v.literal("todo"), v.literal("doing"), v.literal("done")),
    outcome: v.optional(
      v.union(
        v.literal("success"),
        v.literal("error"),
        v.literal("cancelled"),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_run_id", ["runId"])
    .index("by_session_created_at", ["sessionId", "createdAt"]),
});
