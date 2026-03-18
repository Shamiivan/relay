import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    runId: v.id("runs"),
    platform: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const planId = await ctx.db.insert("plan", {
      sessionId: args.sessionId,
      runId: args.runId,
      platform: args.platform,
      prompt: args.prompt,
      status: "todo",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return planId;
  },
});
