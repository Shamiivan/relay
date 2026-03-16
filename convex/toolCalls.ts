/**
 * Durable tool-call records for one run.
 * Tool calls cover both machine tools and human tools.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByRun = query({
  args: {
    runId: v.id("runs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("toolCalls")
      .withIndex("by_run_index", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const create = mutation({
  args: {
    runId: v.id("runs"),
    sessionId: v.id("sessions"),
    runStepId: v.optional(v.id("runSteps")),
    index: v.number(),
    toolName: v.string(),
    toolKind: v.union(v.literal("machine"), v.literal("human")),
    argsJson: v.string(),
    pendingRequestJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("toolCalls", {
      ...args,
      status: args.toolKind === "human" ? "pending" : "running",
      startedAt: Date.now(),
    });
  },
});

export const complete = mutation({
  args: {
    toolCallId: v.id("toolCalls"),
    resultJson: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.toolCallId, {
      status: "completed",
      resultJson: args.resultJson,
      pendingRequestJson: undefined,
      errorType: undefined,
      errorMessage: undefined,
      finishedAt: Date.now(),
    });
  },
});

export const fail = mutation({
  args: {
    toolCallId: v.id("toolCalls"),
    errorType: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.toolCallId, {
      status: "failed",
      errorType: args.errorType,
      errorMessage: args.errorMessage,
      finishedAt: Date.now(),
    });
  },
});

export const cancel = mutation({
  args: {
    toolCallId: v.id("toolCalls"),
    resultJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.toolCallId, {
      status: "cancelled",
      resultJson: args.resultJson,
      finishedAt: Date.now(),
    });
  },
});
