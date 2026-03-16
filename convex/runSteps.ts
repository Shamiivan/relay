/**
 * Durable runtime step records for one run.
 * Run steps are the source of truth for model/tool execution state.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByRun = query({
  args: {
    runId: v.id("runs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("runSteps")
      .withIndex("by_run_index", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const create = mutation({
  args: {
    runId: v.id("runs"),
    sessionId: v.id("sessions"),
    index: v.number(),
    kind: v.union(
      v.literal("model_response"),
      v.literal("tool_execution"),
      v.literal("workflow_step"),
      v.literal("finalize"),
    ),
    modelRequestJson: v.optional(v.string()),
    toolRequestsJson: v.optional(v.string()),
    summaryText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runSteps", {
      ...args,
      schemaVersion: 1,
      status: "started",
      createdAt: Date.now(),
    });
  },
});

export const complete = mutation({
  args: {
    stepId: v.id("runSteps"),
    modelResponseJson: v.optional(v.string()),
    toolResultsJson: v.optional(v.string()),
    summaryText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stepId, {
      status: "completed",
      modelResponseJson: args.modelResponseJson,
      toolResultsJson: args.toolResultsJson,
      summaryText: args.summaryText,
      errorType: undefined,
      errorMessage: undefined,
      finishedAt: Date.now(),
    });
  },
});

export const fail = mutation({
  args: {
    stepId: v.id("runSteps"),
    errorType: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stepId, {
      status: "failed",
      errorType: args.errorType,
      errorMessage: args.errorMessage,
      finishedAt: Date.now(),
    });
  },
});
