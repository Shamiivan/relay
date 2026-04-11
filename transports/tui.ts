import process from "node:process";
import {
  Editor,
  type EditorTheme,
  Markdown,
  type MarkdownTheme,
  matchesKey,
  ProcessTerminal,
  SelectList,
  type SelectListTheme,
  truncateToWidth,
  TUI,
  type Component,
  type Focusable,
} from "../pi-mono/packages/tui/dist/index.js";
import type { ThreadEvent } from "../runtime/src/thread.ts";
import type { TransportAdapter } from "../runtime/src/transport.ts";

const ENTER_ALT_SCREEN = "\u001B[?1049h";
const EXIT_ALT_SCREEN = "\u001B[?1049l";

const ansi = {
  bold: (text: string) => `\u001B[1m${text}\u001B[22m`,
  dim: (text: string) => `\u001B[2m${text}\u001B[22m`,
  cyan: (text: string) => `\u001B[36m${text}\u001B[39m`,
  green: (text: string) => `\u001B[32m${text}\u001B[39m`,
  yellow: (text: string) => `\u001B[33m${text}\u001B[39m`,
};

type HistoryEntry =
  | { kind: "line"; label: string; text: string }
  | { kind: "markdown"; label: string; text: string };

type ClarificationPromptState = {
  kind: "clarification";
  prompt: string;
  editor: Editor;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  settled: boolean;
};

type ApprovalPromptState = {
  kind: "approval";
  prompt: string;
  selector: SelectList;
  resolve: (value: "approved" | "denied") => void;
  reject: (error: Error) => void;
  settled: boolean;
};

type PromptState = ClarificationPromptState | ApprovalPromptState;

type RelayScreenState = {
  history: HistoryEntry[];
  prompt: PromptState | null;
  loaderActive: boolean;
  waitingForExit: boolean;
  exitMessage: string;
};

const markdownTheme: MarkdownTheme = {
  heading: ansi.bold,
  link: ansi.cyan,
  linkUrl: ansi.dim,
  code: ansi.green,
  codeBlock: ansi.green,
  codeBlockBorder: ansi.dim,
  quote: ansi.dim,
  quoteBorder: ansi.dim,
  hr: ansi.dim,
  listBullet: ansi.yellow,
  bold: ansi.bold,
  italic: (text) => `\u001B[3m${text}\u001B[23m`,
  strikethrough: (text) => `\u001B[9m${text}\u001B[29m`,
  underline: (text) => `\u001B[4m${text}\u001B[24m`,
};

const editorTheme: EditorTheme = {
  borderColor: ansi.dim,
  selectList: {
    selectedPrefix: ansi.cyan,
    selectedText: ansi.cyan,
    description: ansi.dim,
    scrollInfo: ansi.dim,
    noMatch: ansi.dim,
  },
};

const approvalTheme: SelectListTheme = {
  selectedPrefix: ansi.cyan,
  selectedText: ansi.cyan,
  description: ansi.dim,
  scrollInfo: ansi.dim,
  noMatch: ansi.dim,
};

function normalizeSingleLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function shortLabel(label: string): string {
  return ansi.dim(`${label.padEnd(9)}`);
}

function formatEventLine(event: ThreadEvent): string {
  switch (event.type) {
    case "system_note":
      return normalizeSingleLine(event.data.slice(0, 120) + (event.data.length > 120 ? "…" : ""));
    case "human_response":
      return normalizeSingleLine(event.data);
    case "request_human_clarification":
      return normalizeSingleLine(event.data.prompt);
    case "request_human_approval":
      return normalizeSingleLine(event.data.prompt);
    case "executable_call":
      return normalizeSingleLine(String(event.data.args).slice(0, 120));
    case "executable_result": {
      const result = String(event.data.result);
      return normalizeSingleLine(result.slice(0, 200) + (result.length > 200 ? "…" : ""));
    }
    default:
      return normalizeSingleLine(String(event.type));
  }
}

function eventToHistoryEntry(event: ThreadEvent): HistoryEntry | null {
  switch (event.type) {
    case "user_message":
      return { kind: "markdown", label: "you", text: event.data };
    case "assistant_message":
      return { kind: "markdown", label: "assistant", text: event.data };
    case "model_response":
      return { kind: "markdown", label: "done", text: event.data };
    case "system_note":
      return { kind: "line", label: "note", text: normalizeSingleLine(event.data) };
    case "human_response":
      return { kind: "line", label: "human", text: normalizeSingleLine(event.data) };
    case "request_human_clarification":
      return { kind: "line", label: "ask", text: normalizeSingleLine(event.data.prompt) };
    case "request_human_approval":
      return { kind: "line", label: "approval", text: normalizeSingleLine(event.data.prompt) };
    case "executable_call":
      return {
        kind: "line",
        label: "bash",
        text: formatEventLine(event),
      };
    case "executable_result":
      return {
        kind: "line",
        label: "result",
        text: formatEventLine(event),
      };
    default:
      return null;
  }
}

class RelayTuiScreen implements Component, Focusable {
  focused = false;
  private scrollOffset = 0;
  private followTail = true;
  private spinnerIndex = 0;
  private readonly spinnerFrames = ["|", "/", "-", "\\"];

  constructor(
    private readonly tui: TUI,
    private readonly state: RelayScreenState,
  ) {
    setInterval(() => {
      if (!this.state.loaderActive || this.state.prompt || this.state.waitingForExit) return;
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
      this.tui.requestRender();
    }, 80).unref();
  }

  invalidate(): void {}

  handleInput(data: string): void {
    if (this.state.waitingForExit) {
      return;
    }

    if (this.state.prompt) {
      if (this.state.prompt.kind === "clarification") {
        this.state.prompt.editor.focused = this.focused;
        this.state.prompt.editor.handleInput?.(data);
      } else {
        this.state.prompt.selector.handleInput?.(data);
      }
      return;
    }

    const maxScroll = this.getMaxScroll();
    if (matchesKey(data, "up")) {
      this.followTail = false;
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
    } else if (matchesKey(data, "down")) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + 1);
      this.followTail = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "pageup")) {
      this.followTail = false;
      this.scrollOffset = Math.max(0, this.scrollOffset - Math.max(1, this.tui.terminal.rows - 4));
    } else if (matchesKey(data, "pagedown")) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + Math.max(1, this.tui.terminal.rows - 4));
      this.followTail = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "home")) {
      this.followTail = false;
      this.scrollOffset = 0;
    } else if (matchesKey(data, "end")) {
      this.followTail = true;
      this.scrollOffset = maxScroll;
    }
  }

  render(width: number): string[] {
    const statusLines = this.renderStatus(width);
    const promptLines = this.renderPrompt(width);
    const reserved = statusLines.length + promptLines.length;
    const historyViewportHeight = Math.max(1, this.tui.terminal.rows - reserved);
    const historyLines = this.renderHistory(width, historyViewportHeight);
    const padding = Math.max(0, historyViewportHeight - historyLines.length);
    const paddedHistory = historyLines.concat(Array.from({ length: padding }, () => ""));
    return [...paddedHistory, ...statusLines, ...promptLines];
  }

  private renderHistory(width: number, viewportHeight: number): string[] {
    const lines = this.state.history.flatMap((entry) => this.renderEntry(entry, width));
    const maxScroll = Math.max(0, lines.length - viewportHeight);
    if (this.followTail) {
      this.scrollOffset = maxScroll;
    } else {
      this.scrollOffset = Math.min(this.scrollOffset, maxScroll);
    }

    const start = Math.min(this.scrollOffset, maxScroll);
    const visible = lines.slice(start, start + viewportHeight);

    if (!this.followTail && visible.length > 0) {
      visible[0] = ansi.dim(`... ${start} line${start === 1 ? "" : "s"} above`);
    }
    if (start + viewportHeight < lines.length && visible.length > 0) {
      visible[visible.length - 1] = ansi.dim(
        `... ${lines.length - (start + viewportHeight)} line${lines.length - (start + viewportHeight) === 1 ? "" : "s"} below`,
      );
    }
    return visible;
  }

  private renderEntry(entry: HistoryEntry, width: number): string[] {
    if (entry.kind === "markdown") {
      const markdown = new Markdown(entry.text, 2, 0, markdownTheme);
      return [shortLabel(entry.label), ...markdown.render(width), ""];
    }

    return [
      truncateToWidth(`${shortLabel(entry.label)} ${entry.text}`, width, ""),
    ];
  }

  private renderStatus(width: number): string[] {
    if (this.state.prompt) {
      return [];
    }

    if (this.state.waitingForExit) {
      return [
        truncateToWidth(
          `${ansi.bold("Press any key to exit")} ${ansi.dim(this.state.exitMessage)}`,
          width,
          "",
        ),
      ];
    }

    if (!this.state.loaderActive) {
      return [truncateToWidth(ansi.dim("idle"), width, "")];
    }

    const frame = this.spinnerFrames[this.spinnerIndex] ?? this.spinnerFrames[0]!;
    return [truncateToWidth(`${ansi.cyan(frame)} ${ansi.dim("working...")}`, width, "")];
  }

  private renderPrompt(width: number): string[] {
    if (!this.state.prompt) {
      return [];
    }

    if (this.state.prompt.kind === "clarification") {
      this.state.prompt.editor.focused = this.focused;
      return [
        "",
        truncateToWidth(`${shortLabel("prompt")} ${this.state.prompt.prompt}`, width, ""),
        ...this.state.prompt.editor.render(width),
      ];
    }

    return [
      "",
      truncateToWidth(`${shortLabel("prompt")} ${this.state.prompt.prompt}`, width, ""),
      ...this.state.prompt.selector.render(width),
    ];
  }

  private getMaxScroll(): number {
    const reserved = this.renderStatus(this.tui.terminal.columns).length
      + this.renderPrompt(this.tui.terminal.columns).length;
    const viewportHeight = Math.max(1, this.tui.terminal.rows - reserved);
    const totalLines = this.state.history.flatMap((entry) =>
      this.renderEntry(entry, this.tui.terminal.columns)
    ).length;
    return Math.max(0, totalLines - viewportHeight);
  }

  snapToBottom(): void {
    this.followTail = true;
    this.scrollOffset = this.getMaxScroll();
  }
}

export class TuiTransport implements TransportAdapter {
  private readonly terminal = new ProcessTerminal();
  private readonly tui = new TUI(this.terminal);
  private readonly state: RelayScreenState = {
    history: [],
    prompt: null,
    loaderActive: true,
    waitingForExit: false,
    exitMessage: "",
  };
  private readonly screen = new RelayTuiScreen(this.tui, this.state);
  private promptQueue: Promise<unknown> = Promise.resolve();
  private stopRequested = false;
  private cleanupDone = false;
  private removeInputListener: (() => void) | null = null;
  private signalHandlersInstalled = false;
  private awaitingExitResolve: (() => void) | null = null;

  constructor() {
    process.stdout.write(ENTER_ALT_SCREEN);
    this.tui.addChild(this.screen);
    this.tui.setFocus(this.screen);
    this.tui.start();
    this.installGlobalHandlers();
  }

  async promptForClarification(prompt: string): Promise<string> {
    return this.enqueuePrompt(() => this.runClarificationPrompt(prompt));
  }

  async promptForApproval(prompt: string): Promise<"approved" | "denied"> {
    this.appendHistory({ kind: "line", label: "approval", text: normalizeSingleLine(prompt) });
    return this.enqueuePrompt(() => this.runApprovalPrompt(prompt));
  }

  async publishEvent(event: ThreadEvent): Promise<void> {
    const entry = eventToHistoryEntry(event);
    if (entry) {
      this.appendHistory(entry);
    }
  }

  async publishFinal(message: string): Promise<void> {
    this.state.loaderActive = false;
    this.state.prompt = null;
    this.appendHistory({ kind: "markdown", label: "final", text: message });
    this.state.waitingForExit = true;
    this.state.exitMessage = "";
    this.screen.snapToBottom();
    this.tui.requestRender();

    await new Promise<void>((resolve) => {
      this.awaitingExitResolve = resolve;
    });

    await this.close();
  }

  async close(): Promise<void> {
    if (this.cleanupDone) {
      return;
    }
    this.cleanupDone = true;
    this.state.prompt?.reject(new Error("TUI closed"));
    this.state.prompt = null;
    this.awaitingExitResolve?.();
    this.awaitingExitResolve = null;
    this.removeInputListener?.();
    this.removeInputListener = null;
    if (this.signalHandlersInstalled) {
      process.removeListener("SIGINT", this.handleSigint);
      process.removeListener("SIGTERM", this.handleSigterm);
      this.signalHandlersInstalled = false;
    }
    this.tui.stop();
    await this.terminal.drainInput();
    process.stdout.write(EXIT_ALT_SCREEN);
  }

  isClosed(): boolean {
    return this.cleanupDone;
  }

  preloadHistory(events: ThreadEvent[]): void {
    for (const event of events) {
      const entry = eventToHistoryEntry(event);
      if (entry) {
        this.state.history.push(entry);
      }
    }
    this.screen.snapToBottom();
    this.tui.requestRender();
  }

  private appendHistory(entry: HistoryEntry): void {
    this.state.history.push(entry);
    this.tui.requestRender();
  }

  private enqueuePrompt<T>(factory: () => Promise<T>): Promise<T> {
    const run = this.promptQueue.then(factory, factory);
    this.promptQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async runClarificationPrompt(prompt: string): Promise<string> {
    this.state.loaderActive = false;

    return new Promise<string>((resolve, reject) => {
      const editor = new Editor(this.tui, editorTheme, { paddingX: 1 });
      const promptState: ClarificationPromptState = {
        kind: "clarification",
        prompt,
        editor,
        resolve,
        reject,
        settled: false,
      };

      editor.onSubmit = (value) => {
        if (promptState.settled) return;
        promptState.settled = true;
        editor.disableSubmit = true;
        this.state.prompt = null;
        this.state.loaderActive = true;
        this.tui.setFocus(this.screen);
        this.tui.requestRender();
        resolve(value.trim());
      };

      this.state.prompt = promptState;
      this.tui.setFocus(this.screen);
      this.tui.requestRender();
    });
  }

  private async runApprovalPrompt(prompt: string): Promise<"approved" | "denied"> {
    this.state.loaderActive = false;

    return new Promise<"approved" | "denied">((resolve, reject) => {
      const selector = new SelectList(
        [
          { value: "approved", label: "Approve" },
          { value: "denied", label: "Deny" },
        ],
        2,
        approvalTheme,
      );
      selector.setSelectedIndex(1);

      const promptState: ApprovalPromptState = {
        kind: "approval",
        prompt,
        selector,
        resolve,
        reject,
        settled: false,
      };

      selector.onSelect = (item) => {
        if (promptState.settled) return;
        promptState.settled = true;
        this.state.prompt = null;
        this.state.loaderActive = true;
        this.tui.setFocus(this.screen);
        this.tui.requestRender();
        resolve(item.value === "approved" ? "approved" : "denied");
      };

      selector.onCancel = () => {
        if (promptState.settled) return;
        promptState.settled = true;
        this.state.prompt = null;
        this.state.loaderActive = true;
        this.tui.setFocus(this.screen);
        this.tui.requestRender();
        resolve("denied");
      };

      this.state.prompt = promptState;
      this.tui.setFocus(this.screen);
      this.tui.requestRender();
    });
  }

  private installGlobalHandlers(): void {
    this.removeInputListener = this.tui.addInputListener((data) => {
      if (matchesKey(data, "ctrl+c")) {
        void this.abortAndExit(130);
        return { consume: true };
      }

      if (this.state.waitingForExit) {
        this.awaitingExitResolve?.();
        this.awaitingExitResolve = null;
        return { consume: true };
      }

      return undefined;
    });

    process.on("SIGINT", this.handleSigint);
    process.on("SIGTERM", this.handleSigterm);
    this.signalHandlersInstalled = true;
  }

  private readonly handleSigint = (): void => {
    void this.abortAndExit(130);
  };

  private readonly handleSigterm = (): void => {
    void this.abortAndExit(143);
  };

  private async abortAndExit(code: number): Promise<void> {
    if (this.stopRequested) {
      return;
    }
    this.stopRequested = true;
    this.state.prompt?.reject(new Error("Interrupted"));
    this.awaitingExitResolve?.();
    this.awaitingExitResolve = null;
    await this.close();
    process.exit(code);
  }
}

export function shouldUseTui(): boolean {
  if (!process.stdout.isTTY) return false;
  if (!process.stdin.isTTY) return false;
  if (process.env.TERM === "dumb") return false;
  if (process.env.CI) return false;
  if (process.env.RELAY_NO_TUI === "1") return false;
  return true;
}

export function createTuiTransport(): TuiTransport {
  return new TuiTransport();
}
