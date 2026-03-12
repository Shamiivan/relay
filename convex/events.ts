/**
 * Event persistence for run history.
 * Events are append-only records used for debugging and replay.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const append = mutation({
  args: {
    runId: v.id("runs"),
    kind: v.union(
      v.literal("user_message"),
      v.literal("tool_call"),
      v.literal("tool_result"),
      v.literal("agent_output"),
      v.literal("run_error"),
    ),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getByRun = query({
  args: {
    runId: v.id("runs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_run_created_at", (q) => q.eq("runId", args.runId))
      .collect();
  },
});
