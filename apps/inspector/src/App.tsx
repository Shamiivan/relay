/**
 * Relay Inspector — 3-pane dashboard for the agent runtime.
 *
 * Panes:
 *   QUEUE      — live list of all recent runs (newest-first)
 *   DETAILS    — selected run metadata + step list
 *   INSPECTOR  — full input/output JSON for the selected step
 *
 * Keyboard:
 *   j / ↓     navigate down in focused pane
 *   k / ↑     navigate up in focused pane
 *   tab       cycle focus between QUEUE and DETAILS/INSPECTOR
 *   q         quit
 */
import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { ConvexClient } from "convex/browser";
// anyApi is what the generated api.js re-exports at runtime; using it directly
// avoids ESM/CJS boundary issues with the generated file.
import { anyApi as api } from "convex/server";
import type { Doc } from "../../../convex/_generated/dataModel";

type Run = Doc<"runs">;
type Step = Doc<"runSteps">;
type ToolCall = Doc<"toolCalls">;

type StepField = {
  label: string;
  value: string;
};

// ─── helpers ────────────────────────────────────────────────────────────────

const RUN_COLOR: Record<string, string> = {
  todo: "yellow",
  doing: "cyan",
  done: "white",
};

const RUN_ICON: Record<string, string> = {
  todo: "·",
  doing: "●",
  done: "✓",
};

const STEP_ICON: Record<string, string> = {
  started: "●",
  completed: "✓",
  failed: "✗",
};

const STEP_COLOR: Record<string, string> = {
  started: "yellow",
  completed: "green",
  failed: "red",
};

/** Pretty-print JSON, truncated to maxLines. */
function fmtJson(raw: string, maxLines = 14): string {
  try {
    const parsed = JSON.parse(raw);
    // For model steps the compiledStep has large `messages` arrays — show summary only.
    const displayable =
      typeof parsed === "object" && parsed !== null && "messages" in parsed
        ? { ...parsed, messages: `[${(parsed.messages as unknown[]).length} messages]` }
        : parsed;
    const pretty = JSON.stringify(displayable, null, 2);
    const lines = pretty.split("\n");
    if (lines.length <= maxLines) return pretty;
    return lines.slice(0, maxLines).join("\n") + `\n  … (${lines.length - maxLines} more lines)`;
  } catch {
    return raw.slice(0, 300);
  }
}

function relativeTime(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

function stepKindLabel(kind: Step["kind"]): string {
  if (kind === "model_response") return "MODEL";
  if (kind === "tool_execution") return "TOOL";
  return "FINAL";
}

function getStepFields(step: Step): StepField[] {
  const fields: StepField[] = [];

  if (step.summaryText) {
    fields.push({ label: "summary", value: step.summaryText });
  }

  if (step.modelRequestJson) {
    fields.push({ label: "model request", value: fmtJson(step.modelRequestJson) });
  }

  if (step.modelResponseJson) {
    fields.push({ label: "model response", value: fmtJson(step.modelResponseJson) });
  }

  if (step.toolRequestsJson) {
    fields.push({ label: "tool requests", value: fmtJson(step.toolRequestsJson) });
  }

  if (step.toolResultsJson) {
    fields.push({ label: "tool results", value: fmtJson(step.toolResultsJson) });
  }

  if (step.errorType || step.errorMessage) {
    fields.push({
      label: "error",
      value: [step.errorType, step.errorMessage].filter(Boolean).join(": "),
    });
  }

  return fields;
}

// ─── component ──────────────────────────────────────────────────────────────

interface AppProps {
  client: ConvexClient;
}

export default function App({ client }: AppProps) {
  const { exit } = useApp();

  const [runs, setRuns] = useState<Run[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  // Selection state
  const [runIdx, setRunIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  // "queue" = j/k moves through runs; "steps" = j/k moves through steps
  const [focus, setFocus] = useState<"queue" | "steps">("queue");

  // Subscribe to all recent runs (reactive)
  useEffect(() => {
    return client.onUpdate(api.runs.listQueue, {}, (data: Run[]) => {
      setRuns(data ?? []);
    });
  }, [client]);

  const selectedRun = runs[runIdx] ?? null;

  // Subscribe to steps for the selected run only
  useEffect(() => {
    if (!selectedRun) return;
    const unsub = client.onUpdate(
      api.runSteps.listByRun,
      { runId: selectedRun._id },
      (data: Step[]) => setSteps(data ?? []),
    );
    setStepIdx(0);
    return unsub;
  }, [client, selectedRun?._id]);

  useEffect(() => {
    if (!selectedRun) return;
    return client.onUpdate(
      api.toolCalls.listByRun,
      { runId: selectedRun._id },
      (data: ToolCall[]) => setToolCalls(data ?? []),
    );
  }, [client, selectedRun?._id]);

  const selectedStep = steps[stepIdx] ?? null;

  // ── keyboard ──────────────────────────────────────────────────────────────
  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }

    if (key.tab) {
      setFocus((f) => (f === "queue" ? "steps" : "queue"));
      return;
    }

    const down = input === "j" || key.downArrow;
    const up = input === "k" || key.upArrow;

    if (focus === "queue") {
      if (down) setRunIdx((i) => Math.min(i + 1, runs.length - 1));
      if (up) setRunIdx((i) => Math.max(i - 1, 0));
    } else {
      if (down) setStepIdx((i) => Math.min(i + 1, steps.length - 1));
      if (up) setStepIdx((i) => Math.max(i - 1, 0));
    }
  });

  const rows = process.stdout.rows ?? 24;

  // ── layout ────────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" height={rows}>
      {/* ── header ── */}
      <Box borderStyle="single" borderColor="blue" paddingX={1}>
        <Text bold color="blue">relay inspector</Text>
        <Text dimColor>  runs:{runs.length}  </Text>
        {selectedRun && (
          <Text dimColor>
            selected:{selectedRun._id.slice(-8)}  steps:{steps.length}
          </Text>
        )}
      </Box>

      {/* ── panes ── */}
      <Box flexDirection="row" flexGrow={1}>
        {/* LEFT: run queue */}
        <Box
          width={30}
          flexDirection="column"
          borderStyle="single"
          borderColor={focus === "queue" ? "cyan" : "gray"}
        >
          <Text bold color={focus === "queue" ? "cyan" : "white"}> QUEUE</Text>
          {runs.length === 0 && <Text dimColor>  (no runs)</Text>}
          {runs.map((run, i) => {
            const active = i === runIdx;
            return (
              <Box key={run._id}>
                <Text
                  color={active ? "black" : RUN_COLOR[run.status]}
                  backgroundColor={active ? "cyan" : undefined}
                >
                  {active ? "▶" : " "}
                  {RUN_ICON[run.status]} {run.status.padEnd(5)}{" "}
                  {run.message.slice(0, 16).padEnd(16)}
                </Text>
              </Box>
            );
          })}
        </Box>

        {/* CENTER: run details + step list */}
        <Box
          flexGrow={1}
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
        >
          <Text bold color="white"> DETAILS</Text>
          {selectedRun ? (
            <Box flexDirection="column">
              <Text>  id       <Text dimColor>{selectedRun._id.slice(-12)}</Text></Text>
              <Text>  status   <Text color={RUN_COLOR[selectedRun.status]}>{selectedRun.status}</Text>{selectedRun.outcome ? ` (${selectedRun.outcome})` : ""}</Text>
              <Text>  mode     {selectedRun.executionMode}</Text>
              <Text>  waiting  {selectedRun.waitingOn ?? "none"}</Text>
              <Text>  turns    {selectedRun.turnCount}</Text>
              <Text>  tools    {toolCalls.length}</Text>
              <Text>  created  <Text dimColor>{relativeTime(selectedRun._creationTime)}</Text></Text>
              <Text>  </Text>
              <Text>  msg  <Text dimColor>{selectedRun.message.slice(0, 55)}</Text></Text>
              {selectedRun.outputText && (
                <Text>  out  <Text color="green">{selectedRun.outputText.slice(0, 55)}</Text></Text>
              )}
              {selectedRun.errorMessage && (
                <Text>  err  <Text color="red">{selectedRun.errorMessage.slice(0, 55)}</Text></Text>
              )}
              <Text>  </Text>
              <Text bold color={focus === "steps" ? "cyan" : "white"}>
                {" "}STEPS ({steps.length})
              </Text>
              {steps.length === 0 && <Text dimColor>   (none)</Text>}
              {steps.map((step, i) => {
                const active = i === stepIdx && focus === "steps";
                return (
                  <Box key={step._id}>
                    <Text color={active ? "cyan" : undefined}>
                      {active ? "  ▶" : "   "}
                      {" "}{step.index + 1}. {stepKindLabel(step.kind).charAt(0)}{" "}
                      <Text color={STEP_COLOR[step.status]}>{STEP_ICON[step.status]}</Text>
                      {step.status === "started" ? " running…" : ""}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Text dimColor>  Select a run from the queue (j/k)</Text>
          )}
        </Box>

        {/* RIGHT: step inspector */}
        <Box
          width={46}
          flexDirection="column"
          borderStyle="single"
          borderColor={focus === "steps" ? "cyan" : "gray"}
        >
          <Text bold color="white"> INSPECTOR</Text>
          {selectedStep ? (
            <Box flexDirection="column">
              <Text>
                {"  "}step {selectedStep.index + 1}{" "}
                <Text color="cyan">{selectedStep.kind}</Text>{" · "}
                <Text color={STEP_COLOR[selectedStep.status]}>
                  {selectedStep.status}
                </Text>
              </Text>
              {getStepFields(selectedStep).map((field) => (
                <React.Fragment key={field.label}>
                  <Text>  </Text>
                  <Text bold>  {field.label}:</Text>
                  <Text
                    dimColor={field.label !== "error"}
                    color={field.label === "error" ? "red" : undefined}
                    wrap="truncate-end"
                  >
                    {field.value}
                  </Text>
                </React.Fragment>
              ))}
            </Box>
          ) : (
            <Text dimColor>  Tab → steps, then j/k to select</Text>
          )}
        </Box>
      </Box>

      {/* ── footer ── */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>q:quit  tab:switch pane  j/k:navigate</Text>
      </Box>
    </Box>
  );
}
