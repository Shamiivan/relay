/**
 * Run lifecycle functions persisted in Convex.
 * Public mutations capture intent and workers advance the workflow.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const defaultSpecialistId = "communication";

export const create = mutation({
  args: {
    message: v.string(),
    userId: v.string(),
    channelId: v.string(),
  },
  /**
   * Finds or creates a durable thread, then enqueues a run against it.
   */
  handler: async (ctx, args) => {
    const specialistId = defaultSpecialistId;
    const existingThread = await ctx.db
      .query("threads")
      .withIndex("by_channel_user_specialist", (q) =>
        q
          .eq("channelId", args.channelId)
          .eq("userId", args.userId)
          .eq("specialistId", specialistId),
      )
      .first();
    const now = Date.now();

    const threadId =
      existingThread?._id ??
      (await ctx.db.insert("threads", {
        userId: args.userId,
        channelId: args.channelId,
        specialistId,
        createdAt: now,
        updatedAt: now,
      }));

    if (existingThread) {
      await ctx.db.patch(existingThread._id, {
        updatedAt: now,
      });
    }

    const runId = await ctx.db.insert("runs", {
      threadId,
      userId: args.userId,
      channelId: args.channelId,
      message: args.message,
      specialistId,
      status: "todo",
      turnCount: 0,
      deliveryState: "queued",
    });

    await ctx.db.insert("threadMessages", {
      threadId,
      runId,
      kind: "user_message",
      text: args.message,
      createdAt: now,
    });
    return { runId, threadId };
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

export const listTodo = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "todo"))
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
      .withIndex("by_status", (q) => q.eq("status", "todo"))
      .first();

    if (!run) {
      return null;
    }

    await ctx.db.patch(run._id, {
      status: "doing",
      turnCount: run.turnCount + 1,
    });

    return {
      ...run,
      status: "doing" as const,
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
      status: "done",
      outcome: "success",
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
      status: "done",
      outcome: "error",
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
