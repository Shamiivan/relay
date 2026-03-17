/**
 * Run lifecycle functions persisted in Convex.
 * Public mutations capture intent and workers advance the workflow.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const defaultSpecialistId = "communication";
const transportValidator = v.union(
  v.literal("discord"),
  v.literal("cli"),
  v.literal("tui"),
);

export const create = mutation({
  args: {
    message: v.string(),
    userId: v.string(),
    threadKey: v.string(),
  },
  /**
   * Finds or creates a durable session, then enqueues a run against it.
   */
  handler: async (ctx, args) => {
    const specialistId = defaultSpecialistId;
    const existingSession = await ctx.db
      .query("sessions")
      .withIndex("by_thread_user_specialist", (q) =>
        q
          .eq("threadKey", args.threadKey)
          .eq("userId", args.userId)
          .eq("specialistId", specialistId),
      )
      .first();
    const now = Date.now();

    const sessionId =
      existingSession?._id ??
      (await ctx.db.insert("sessions", {
        userId: args.userId,
        threadKey: args.threadKey,
        specialistId,
        createdAt: now,
        updatedAt: now,
      }));

    if (existingSession) {
      await ctx.db.patch(existingSession._id, {
        updatedAt: now,
      });
    }

    const runId = await ctx.db.insert("runs", {
      sessionId,
      userId: args.userId,
      threadKey: args.threadKey,
      message: args.message,
      specialistId,
      executionMode: existingSession?.activeWorkflowName ? "workflow" : "open_loop",
      workflowName: existingSession?.activeWorkflowName,
      status: "todo",
      turnCount: 0,
      waitingOn: "none",
      deliveryState: "queued",
    });

    await ctx.db.insert("events", {
      sessionId,
      runId,
      kind: "run.created",
      dataJson: JSON.stringify({
        message: args.message,
        specialistId,
        executionMode: "open_loop",
      }),
      createdAt: now,
    });

    await ctx.db.insert("sessionMessages", {
      sessionId,
      runId,
      kind: "user_message",
      text: args.message,
      createdAt: now,
    });
    return { runId, sessionId };
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
  args: {
    transport: v.optional(transportValidator),
  },
  /**
   * Returns finished or failed runs that the bot has not delivered yet.
   */
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("runs")
      .withIndex("by_delivery_state", (q) => q.eq("deliveryState", "ready"))
      .collect();

    return args.transport
      ? runs.filter((run) => run.transport === args.transport)
      : runs;
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

export const listQueue = query({
  args: {},
  /**
   * Returns the 50 most recent runs across all statuses for the TUI queue view.
   * Ordered newest-first so active work stays at the top.
   */
  handler: async (ctx) => {
    return await ctx.db.query("runs").order("desc").take(50);
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

    await ctx.db.insert("events", {
      sessionId: run.sessionId,
      runId: run._id,
      kind: "run.claimed",
      dataJson: JSON.stringify({
        turnCount: run.turnCount + 1,
        executionMode: run.executionMode,
      }),
      createdAt: Date.now(),
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
      waitingOn: "none",
      outputText: args.outputText,
      errorType: undefined,
      errorMessage: undefined,
      deliveryState: "ready",
    });

    const run = await ctx.db.get(args.runId);
    if (run) {
      await ctx.db.insert("events", {
        sessionId: run.sessionId,
        runId: run._id,
        kind: "run.completed",
        dataJson: JSON.stringify({
          outputText: args.outputText,
        }),
        createdAt: Date.now(),
      });
    }
  },
});

export const setWorkflowExecution = mutation({
  args: {
    runId: v.id("runs"),
    workflowName: v.string(),
    workflowVersion: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      executionMode: "workflow",
      workflowName: args.workflowName,
      workflowVersion: args.workflowVersion,
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
      waitingOn: "none",
      errorType: args.errorType,
      errorMessage: args.errorMessage,
      deliveryState: "ready",
    });

    const run = await ctx.db.get(args.runId);
    if (run) {
      await ctx.db.insert("events", {
        sessionId: run.sessionId,
        runId: run._id,
        kind: "run.failed",
        dataJson: JSON.stringify({
          errorType: args.errorType,
          errorMessage: args.errorMessage,
        }),
        createdAt: Date.now(),
      });
    }
  },
});

export const setWaitingOnHuman = mutation({
  args: {
    runId: v.id("runs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      waitingOn: "human",
    });
  },
});

export const clearWaitingOn = mutation({
  args: {
    runId: v.id("runs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      waitingOn: "none",
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
