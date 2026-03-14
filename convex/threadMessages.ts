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
    kind: v.union(v.literal("user_message"), v.literal("assistant_message")),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("threadMessages", {
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
      .query("threadMessages")
      .withIndex("by_thread_created_at", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(args.limit ?? 20);

    return events.reverse();
  },
});
