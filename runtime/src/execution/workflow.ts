import type { ConvexClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { SpecialistConfig } from "../../../packages/contracts/src";
import { createModelAdapter } from "../../../packages/model/src/provider";
import { explainError } from "../explain-error";
import { generateText } from "../generate-text";
import type { RunDoc } from "../primitives/run";
import type { SessionDoc } from "../primitives/session";
import { appendTraceEvent } from "../tracing/trace-file";
import { executeToolCall } from "../tools/execute-tool-call";
import type { ToolManifest } from "../tools/tool-registry";
import { getWorkflow, getWorkflowPrompt, workflowNames } from "../../../workflows/_generated/registry";
import type { WorkflowDeclaration } from "../../../workflows/sdk";
import type { RuntimeEnv } from "./open-loop";

type WorkflowDispatchResult =
  | { status: "completed"; outputText: string; workflowName: string }
  | { status: "handoff_to_open_loop"; workflowName: string };

function buildSystemInstruction(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

function isDeclaredWorkflowName(
  name: string | undefined,
): name is (typeof workflowNames)[number] {
  return typeof name === "string"
    && workflowNames.includes(name as (typeof workflowNames)[number]);
}

function summarizeStep(stepName: string, summaryText?: string): string {
  return summaryText ?? `Workflow step ${stepName} completed.`;
}

async function executeRegisteredTool(
  allowedTools: ToolManifest[],
  toolName: string,
  args: unknown,
): Promise<unknown> {
  const tool = allowedTools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return {
      error: {
        type: "validation",
        field: "tool_name",
        reason: "Unknown tool",
      },
    };
  }

  try {
    return await executeToolCall(tool, args);
  } catch (error) {
    return {
      error: {
        type: "external_error",
        message: error instanceof Error ? error.message : "Unknown tool execution error",
      },
    };
  }
}

export async function runWorkflow(params: {
  convex: ConvexClient;
  run: RunDoc;
  session: SessionDoc;
  specialist: SpecialistConfig;
  allowedTools: ToolManifest[];
  env: RuntimeEnv;
  runLogger: {
    info: (message: string, data?: Record<string, unknown>) => void;
  };
  traceFile: string;
  baseSystemInstruction: string;
}): Promise<WorkflowDispatchResult | null> {
  const { convex, run, session, specialist, allowedTools, env, runLogger, traceFile, baseSystemInstruction } = params;
  const workflow = (() => {
    const activeWorkflowName = session.activeWorkflowName;
    if (isDeclaredWorkflowName(activeWorkflowName)) {
      return getWorkflow(activeWorkflowName);
    }

    const runWorkflowName = run.workflowName;
    if (run.executionMode === "workflow" && isDeclaredWorkflowName(runWorkflowName)) {
      return getWorkflow(runWorkflowName);
    }

    return workflowNames
      .map((name) => getWorkflow(name))
      .find((candidate) =>
        candidate.specialist === specialist.id
        && candidate.trigger.matches({ run, session, specialist })
      ) ?? null;
  })();

  if (!workflow) {
    return null;
  }

  const adapter = createModelAdapter(env);
  const workflowPrompt = getWorkflowPrompt(workflow.name);
  const systemInstruction = buildSystemInstruction([baseSystemInstruction, workflowPrompt]);
  const parsedState = workflow.state.parse(
    session.activeWorkflowName === workflow.name && session.workflowStateJson
      ? JSON.parse(session.workflowStateJson)
      : workflow.initialState,
  );
  let stepName = (
    session.activeWorkflowName === workflow.name && session.workflowStepName
      ? session.workflowStepName
      : workflow.initialStep
  ) as keyof typeof workflow.steps & string;
  let state = parsedState;

  await convex.mutation(api.runs.setWorkflowExecution, {
    runId: run._id,
    workflowName: workflow.name,
    workflowVersion: workflow.version ?? 1,
  });

  for (let index = 0; index < 20; index += 1) {
    const step = workflow.steps[stepName];
    if (!step) {
      throw new Error(`Workflow ${workflow.name} is missing step ${stepName}`);
    }

    const runSteps = await convex.query(api.runSteps.listByRun, {
      runId: run._id,
    });
    const runStepId = await convex.mutation(api.runSteps.create, {
      runId: run._id,
      sessionId: run.sessionId,
      index: runSteps.length,
      kind: "workflow_step",
      summaryText: `Running workflow step ${stepName}.`,
    });

    try {
      const result = await step({
        run,
        session,
        specialist,
        state,
        stepName,
        tools: {
          getTool(toolName) {
            return allowedTools.find((tool) => tool.name === toolName);
          },
          execute(toolName, args) {
            return executeRegisteredTool(allowedTools, toolName, args);
          },
          async executeTool(tool, args) {
            return await executeRegisteredTool(allowedTools, tool.name, args) as never;
          },
        },
        explainError: async (input) => await explainError(adapter, input),
        generateText: async (input) => await generateText(adapter, {
          systemInstruction: buildSystemInstruction([systemInstruction, input.systemInstruction]),
          prompt: input.prompt,
        }),
      });
      state = workflow.state.parse(result.state);

      if (result.handoffToOpenLoop) {
        await convex.mutation(api.sessions.clearWorkflowState, {
          sessionId: session._id,
        });
        await convex.mutation(api.runSteps.complete, {
          stepId: runStepId,
          summaryText: summarizeStep(stepName, result.summaryText),
        });
        await appendTraceEvent(traceFile, "workflow_handoff_to_open_loop", {
          timestamp: new Date().toISOString(),
          workflowName: workflow.name,
          stepName,
        });
        return {
          status: "handoff_to_open_loop",
          workflowName: workflow.name,
        };
      }

      if (!result.nextStep) {
        await convex.mutation(api.sessions.clearWorkflowState, {
          sessionId: session._id,
        });
        await convex.mutation(api.runSteps.complete, {
          stepId: runStepId,
          summaryText: summarizeStep(stepName, result.summaryText),
        });
        await appendTraceEvent(traceFile, "workflow_completed", {
          timestamp: new Date().toISOString(),
          workflowName: workflow.name,
          stepName,
        });
        return {
          status: "completed",
          outputText: result.outputText ?? "",
          workflowName: workflow.name,
        };
      }

      await convex.mutation(api.sessions.setWorkflowState, {
        sessionId: session._id,
        activeWorkflowName: workflow.name,
        workflowStateJson: JSON.stringify(state),
        workflowStepName: result.nextStep,
      });
      await convex.mutation(api.runSteps.complete, {
        stepId: runStepId,
        summaryText: summarizeStep(stepName, result.summaryText),
      });
      await appendTraceEvent(traceFile, "workflow_step_completed", {
        timestamp: new Date().toISOString(),
        workflowName: workflow.name,
        stepName,
        nextStepName: result.nextStep,
      });
      runLogger.info("workflow_step_completed", {
        workflowName: workflow.name,
        stepName,
        nextStepName: result.nextStep,
      });

      if (result.outputText) {
        return {
          status: "completed",
          outputText: result.outputText,
          workflowName: workflow.name,
        };
      }

      stepName = result.nextStep;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown workflow step failure";
      await convex.mutation(api.runSteps.fail, {
        stepId: runStepId,
        errorType: "workflow_error",
        errorMessage: message,
      });
      throw error;
    }
  }

  throw new Error(`Workflow ${workflow.name} exceeded the maximum number of chained steps`);
}
