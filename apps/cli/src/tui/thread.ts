import type { Doc } from "../../../../convex/_generated/dataModel";
import { Container, LoaderComponent } from "../../../../packages/tui/src/index.ts";
import type { TuiTransport } from "../../../../packages/transport/src/tui.ts";
import { AssistantMessage } from "./components/AssistantMessage";
import { ErrorMessage } from "./components/ErrorMessage";
import { HumanApprovalComponent } from "./components/HumanApprovalComponent";
import { ToolCallComponent } from "./components/ToolCallComponent";

type ThreadRendererOptions = {
  transport: TuiTransport;
  chatContainer: Container;
  statusContainer: Container;
  requestRender: () => void;
  onRunSettled: () => void;
};

export class ThreadRenderer {
  private readonly transport: TuiTransport;
  private readonly chatContainer: Container;
  private readonly statusContainer: Container;
  private readonly requestRender: () => void;
  private readonly onRunSettled: () => void;
  private readonly renderedEventIds = new Set<string>();
  private unsubscribeRun: (() => void) | null = null;
  private toolCallContainer: Container | null = null;

  constructor(options: ThreadRendererOptions) {
    this.transport = options.transport;
    this.chatContainer = options.chatContainer;
    this.statusContainer = options.statusContainer;
    this.requestRender = options.requestRender;
    this.onRunSettled = options.onRunSettled;
  }

  watchRun(runId: Doc<"runs">["_id"]): void {
    this.unsubscribeRun?.();
    this.renderedEventIds.clear();
    this.toolCallContainer = new Container({ gap: 1 });
    this.chatContainer.addChild(this.toolCallContainer);
    this.unsubscribeRun = this.transport.watchRun(runId, {
      onEvents: (events) => this.renderEvents(events),
      onToolCalls: (toolCalls) => this.renderToolCalls(toolCalls),
      onRun: (run) => this.handleRun(run),
    });
  }

  stop(): void {
    this.unsubscribeRun?.();
    this.unsubscribeRun = null;
  }

  private renderEvents(events: Doc<"events">[]): void {
    for (const event of events) {
      if (this.renderedEventIds.has(event._id)) {
        continue;
      }

      this.renderedEventIds.add(event._id);
      const data = parseJson(event.dataJson);

      switch (event.kind) {
        case "run.claimed":
          this.statusContainer.setChildren([new LoaderComponent("thinking...")]);
          break;
        case "run.completed":
          this.chatContainer.addChild(
            new AssistantMessage(readStringField(data, "outputText", "Run finished without output.")),
          );
          break;
        case "run.failed":
          this.chatContainer.addChild(
            new ErrorMessage(
              readStringField(
                data,
                "errorMessage",
                `Run failed: ${readStringField(data, "errorType", "unknown_error")}`,
              ),
            ),
          );
          break;
      }
    }

    this.requestRender();
  }

  private renderToolCalls(toolCalls: Doc<"toolCalls">[]): void {
    if (!this.toolCallContainer) {
      return;
    }

    this.toolCallContainer.setChildren(
      toolCalls
        .sort((left, right) => left.index - right.index)
        .map((toolCall) => {
          if (toolCall.toolKind === "human") {
            return new HumanApprovalComponent(
              readStringField(parseJson(toolCall.pendingRequestJson), "prompt", "Approval required."),
            );
          }

          return new ToolCallComponent(
            toolCall.toolName,
            toolCall.status,
            summarizeResult(toolCall.resultJson),
          );
        }),
    );
    this.requestRender();
  }

  private handleRun(run: Doc<"runs"> | null): void {
    if (!run || run.status !== "done") {
      return;
    }

    this.statusContainer.clear();
    this.onRunSettled();
    this.requestRender();
  }
}

function parseJson(value: string | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function readStringField(
  value: Record<string, unknown>,
  field: string,
  fallback: string,
): string {
  const result = value[field];
  return typeof result === "string" && result.trim() ? result : fallback;
}

function summarizeResult(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}
