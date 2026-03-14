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
    threadId: v.id("threads"),
    index: v.number(),
    kind: v.union(v.literal("model"), v.literal("tool")),
    inputJson: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("runSteps", {
      ...args,
      status: "started",
      createdAt: Date.now(),
    });
  },
});

export const complete = mutation({
  args: {
    stepId: v.id("runSteps"),
    outputJson: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stepId, {
      status: "completed",
      outputJson: args.outputJson,
      errorMessage: undefined,
      finishedAt: Date.now(),
    });
  },
});

export const fail = mutation({
  args: {
    stepId: v.id("runSteps"),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.stepId, {
      status: "failed",
      errorMessage: args.errorMessage,
      finishedAt: Date.now(),
    });
  },
});
