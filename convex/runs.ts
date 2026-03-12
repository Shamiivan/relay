/**
 * Run lifecycle functions persisted in Convex.
 * Public mutations capture intent and workers advance the workflow.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    message: v.string(),
    userId: v.string(),
    channelId: v.string(),
    specialistId: v.optional(v.string()),
  },
  /**
   * Creates a durable run and appends the initial user event.
   */
  handler: async (ctx, args) => {
    const runId = await ctx.db.insert("runs", {
      userId: args.userId,
      channelId: args.channelId,
      message: args.message,
      specialistId: args.specialistId ?? "communication",
      status: "pending",
      turnCount: 0,
      deliveryState: "queued",
    });

    await ctx.db.insert("events", {
      runId,
      kind: "user_message",
      text: args.message,
      createdAt: Date.now(),
    });
    return runId;
  },
});

export const get = query({
  args: {
    runId: v.id("runs"),
  },
  /**
   * Fetches a run by id for the bot polling path.
   * The bot only needs status and final output from this read.
   */
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

export const listDeliverable = query({
  args: {},
  /**
   * Returns finished or failed runs that the bot has not delivered yet.
   */
  handler: async (ctx) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_delivery_state", (q) => q.eq("deliveryState", "ready"))
      .collect();
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const claim = mutation({
  args: {},
  /**
   * Claims one pending run for a local worker.
   * The first worker to patch the run wins the claim.
   */
  handler: async (ctx) => {
    const run = await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();

    if (!run) {
      return null;
    }

    await ctx.db.patch(run._id, {
      status: "running",
      turnCount: run.turnCount + 1,
    });

    return {
      ...run,
      status: "running" as const,
      turnCount: run.turnCount + 1,
    };
  },
});

export const finish = mutation({
  args: {
    runId: v.id("runs"),
    outputText: v.string(),
  },
  /**
   * Stores the final agent output for a successful run.
   * Errors are cleared so the record has one terminal result shape.
   */
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "finished",
      outputText: args.outputText,
      errorType: undefined,
      errorMessage: undefined,
      deliveryState: "ready",
    });
  },
});

export const fail = mutation({
  args: {
    runId: v.id("runs"),
    errorType: v.string(),
    errorMessage: v.string(),
  },
  /**
   * Stores the terminal failure state for a run.
   * Errors are explicit named fields rather than inferred from logs.
   */
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "failed",
      errorType: args.errorType,
      errorMessage: args.errorMessage,
      deliveryState: "ready",
    });
  },
});

export const markDelivered = mutation({
  args: {
    runId: v.id("runs"),
  },
  /**
   * Marks a terminal run as delivered by the transport layer.
   */
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      deliveryState: "sent",
      deliveredAt: Date.now(),
    });
  },
});
