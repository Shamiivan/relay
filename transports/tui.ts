import process from "node:process";
import {
  type Component,
  Editor,
  type EditorTheme,
  Loader,
  Markdown,
  type MarkdownTheme,
  matchesKey,
  ProcessTerminal,
  Text,
  TUI,
} from "../pi-mono/packages/tui/dist/index.js";
import type { ThreadEvent } from "../runtime/src/thread.ts";
import type { TransportAdapter } from "../runtime/src/transport.ts";

const ENTER_ALT_SCREEN = "\u001B[?1049h";
const EXIT_ALT_SCREEN = "\u001B[?1049l";

const ansi = {
  bold: (s: string) => `\u001B[1m${s}\u001B[22m`,
  dim: (s: string) => `\u001B[2m${s}\u001B[22m`,
  cyan: (s: string) => `\u001B[36m${s}\u001B[39m`,
  green: (s: string) => `\u001B[32m${s}\u001B[39m`,
  yellow: (s: string) => `\u001B[33m${s}\u001B[39m`,
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
  italic: (s) => `\u001B[3m${s}\u001B[23m`,
  strikethrough: (s) => `\u001B[9m${s}\u001B[29m`,
  underline: (s) => `\u001B[4m${s}\u001B[24m`,
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

function tag(name: string, body: string): string {
  const open = ansi.dim(`<${name}>`);
  const close = ansi.dim(`</${name}>`);
  return `${open}\n${body}\n${close}`;
}

function eventToComponent(event: ThreadEvent): Component | null {
  switch (event.type) {
    case "user_message":
      return new Text(tag("user_message", event.data), 0, 1);
    case "assistant_message":
      return new Markdown(event.data, 0, 1, markdownTheme);
    case "model_response":
      return new Markdown(event.data, 0, 1, markdownTheme);
    case "system_note":
      return new Text(tag("system_note", event.data), 0, 1);
    case "human_response":
      return new Text(tag("human_response", event.data), 0, 1);
    case "request_human_clarification":
      return new Text(tag("request_human_clarification", event.data.prompt), 0, 1);
    case "request_human_approval":
      return new Text(tag("request_human_approval", event.data.prompt), 0, 1);
    case "executable_call":
      return new Text(
        tag(
          "executable_call",
          `executableName: ${event.data.executableName}\nargs: ${String(event.data.args)}`,
        ),
        0,
        1,
      );
    case "executable_result":
      return new Text(
        tag(
          "executable_result",
          `executableName: ${event.data.executableName}\nresult: ${String(event.data.result)}`,
        ),
        0,
        1,
      );
    default:
      return null;
  }
}

export class TuiTransport implements TransportAdapter {
  private readonly terminal = new ProcessTerminal();
  private readonly tui = new TUI(this.terminal);
  private readonly editor: Editor;
  private loader: Loader | null = null;
  private clarifyResolve: ((value: string) => void) | null = null;
  private approvalResolve: ((value: "approved" | "denied") => void) | null = null;
  private awaitingExitResolve: (() => void) | null = null;
  private stopRequested = false;
  private cleanupDone = false;
  private removeInputListener: (() => void) | null = null;
  private signalHandlersInstalled = false;
  private promptQueue: Promise<unknown> = Promise.resolve();

  constructor() {
    process.stdout.write(ENTER_ALT_SCREEN);
    this.editor = new Editor(this.tui, editorTheme, { paddingX: 1 });
    this.editor.disableSubmit = true;
    this.editor.onSubmit = (value) => this.handleEditorSubmit(value);
    this.tui.addChild(this.editor);
    this.tui.setFocus(this.editor);
    this.startLoader();
    this.tui.start();
    this.installGlobalHandlers();
  }

  async publishEvent(event: ThreadEvent): Promise<void> {
    const comp = eventToComponent(event);
    if (comp) this.insertAboveTail(comp);
  }

  async publishFinal(message: string): Promise<void> {
    this.stopLoader();
    this.insertAboveTail(new Markdown(message, 0, 1, markdownTheme));
    this.insertAboveTail(new Text(ansi.dim("Press any key to exit"), 0, 1));
    this.editor.disableSubmit = true;
    this.tui.requestRender();
    await new Promise<void>((resolve) => {
      this.awaitingExitResolve = resolve;
    });
    await this.close();
  }

  async promptForClarification(prompt: string): Promise<string> {
    return this.enqueue(
      () =>
        new Promise<string>((resolve) => {
          this.stopLoader();
          this.insertAboveTail(new Text(tag("request_human_clarification", prompt), 0, 1));
          this.editor.disableSubmit = false;
          this.tui.setFocus(this.editor);
          this.clarifyResolve = resolve;
          this.tui.requestRender();
        }),
    );
  }

  async promptForApproval(prompt: string): Promise<"approved" | "denied"> {
    return this.enqueue(
      () =>
        new Promise<"approved" | "denied">((resolve) => {
          this.stopLoader();
          this.insertAboveTail(
            new Text(
              tag(
                "request_human_approval",
                `${prompt}\n${ansi.dim("(reply y/yes to approve, anything else denies)")}`,
              ),
              0,
              1,
            ),
          );
          this.editor.disableSubmit = false;
          this.tui.setFocus(this.editor);
          this.approvalResolve = resolve;
          this.tui.requestRender();
        }),
    );
  }

  preloadHistory(events: ThreadEvent[]): void {
    for (const event of events) {
      const comp = eventToComponent(event);
      if (comp) this.insertAboveTail(comp);
    }
    this.tui.requestRender();
  }

  async close(): Promise<void> {
    if (this.cleanupDone) return;
    this.cleanupDone = true;
    this.clarifyResolve?.("");
    this.clarifyResolve = null;
    this.approvalResolve?.("denied");
    this.approvalResolve = null;
    this.awaitingExitResolve?.();
    this.awaitingExitResolve = null;
    this.stopLoader();
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

  private insertAboveTail(component: Component): void {
    const children = this.tui.children;
    const tailSize = this.loader ? 2 : 1;
    children.splice(children.length - tailSize, 0, component);
    this.tui.requestRender();
  }

  private startLoader(): void {
    if (this.loader) return;
    const loader = new Loader(this.tui, ansi.cyan, ansi.dim, "working...");
    this.loader = loader;
    const children = this.tui.children;
    children.splice(children.length - 1, 0, loader);
    loader.start();
    this.tui.requestRender();
  }

  private stopLoader(): void {
    if (!this.loader) return;
    this.loader.stop();
    this.tui.removeChild(this.loader);
    this.loader = null;
    this.tui.requestRender();
  }

  private handleEditorSubmit(value: string): void {
    const trimmed = value.trim();
    if (this.approvalResolve) {
      const decision: "approved" | "denied" = /^y(es)?$/i.test(trimmed) ? "approved" : "denied";
      const resolve = this.approvalResolve;
      this.approvalResolve = null;
      this.editor.disableSubmit = true;
      this.insertAboveTail(new Text(tag("human_response", trimmed), 0, 1));
      this.startLoader();
      resolve(decision);
      return;
    }
    if (this.clarifyResolve) {
      const resolve = this.clarifyResolve;
      this.clarifyResolve = null;
      this.editor.disableSubmit = true;
      this.insertAboveTail(new Text(tag("human_response", trimmed), 0, 1));
      this.startLoader();
      resolve(trimmed);
      return;
    }
  }

  private enqueue<T>(factory: () => Promise<T>): Promise<T> {
    const run = this.promptQueue.then(factory, factory);
    this.promptQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private installGlobalHandlers(): void {
    this.removeInputListener = this.tui.addInputListener((data) => {
      if (matchesKey(data, "ctrl+c")) {
        void this.abortAndExit(130);
        return { consume: true };
      }
      if (this.awaitingExitResolve) {
        this.awaitingExitResolve();
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
    if (this.stopRequested) return;
    this.stopRequested = true;
    this.clarifyResolve?.("");
    this.clarifyResolve = null;
    this.approvalResolve?.("denied");
    this.approvalResolve = null;
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
