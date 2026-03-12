/**
 * Event persistence for durable thread history.
 * Thread events are the source of truth for what happened in a conversation.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const append = mutation({
  args: {
    threadId: v.id("threads"),
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
    await ctx.db.insert("threadEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getRecentByThread = query({
  args: {
    threadId: v.id("threads"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("threadEvents")
      .withIndex("by_thread_created_at", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(args.limit ?? 20);

    return events.reverse();
  },
});
