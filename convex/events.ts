/**
 * Durable runtime events for audit and debugging.
 * Events are append-only and secondary to the main state tables.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const append = mutation({
  args: {
    sessionId: v.id("sessions"),
    runId: v.optional(v.id("runs")),
    runStepId: v.optional(v.id("runSteps")),
    toolCallId: v.optional(v.id("toolCalls")),
    kind: v.string(),
    dataJson: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("events", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listByRun = query({
  args: {
    runId: v.id("runs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_run_created_at", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(args.limit ?? 100);

    return events.reverse();
  },
});
