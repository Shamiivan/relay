import type { Component } from "./container";
import { ProcessTerminal } from "./terminal";

export class Tui {
  constructor(
    private readonly terminal: ProcessTerminal,
    private readonly root: Component,
  ) {}

  start(): void {
    this.terminal.start();
    this.requestRender();
  }

  requestRender(): void {
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(this.root.render(this.terminal.width).slice(-this.terminal.height).join("\n"));
  }

  close(): void {
    this.terminal.stop();
    process.stdout.write("\x1b[2J\x1b[H");
  }
}
