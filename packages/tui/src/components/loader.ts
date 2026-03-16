import type { Component } from "../container";

const frames = ["-", "\\", "|", "/"];

export class LoaderComponent implements Component {
  constructor(private text: string) {}

  render(): string[] {
    return [`${frames[Math.floor(Date.now() / 120) % frames.length]} ${this.text}`];
  }
}
