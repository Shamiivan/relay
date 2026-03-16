import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const setWorkflowState = mutation({
  args: {
    sessionId: v.id("sessions"),
    activeWorkflowName: v.string(),
    workflowStateJson: v.string(),
    workflowStepName: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      activeWorkflowName: args.activeWorkflowName,
      workflowStateJson: args.workflowStateJson,
      workflowStepName: args.workflowStepName,
      updatedAt: Date.now(),
    });
  },
});

export const clearWorkflowState = mutation({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      activeWorkflowName: undefined,
      workflowStateJson: undefined,
      workflowStepName: undefined,
      updatedAt: Date.now(),
    });
  },
});
