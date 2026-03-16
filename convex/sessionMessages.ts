/**
 * Durable session message history for human-visible conversation only.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const append = mutation({
  args: {
    sessionId: v.id("sessions"),
    runId: v.id("runs"),
    kind: v.union(v.literal("user_message"), v.literal("assistant_message")),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessionMessages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getRecentBySession = query({
  args: {
    sessionId: v.id("sessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("sessionMessages")
      .withIndex("by_session_created_at", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.limit ?? 20);

    return events.reverse();
  },
});
