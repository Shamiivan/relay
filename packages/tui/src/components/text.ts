import type { Component } from "../container";
import { wrapTextWithAnsi } from "../utils";

export class TextComponent implements Component {
  constructor(private text: string) {}

  setText(text: string): void {
    this.text = text;
  }

  render(width: number): string[] {
    return wrapTextWithAnsi(this.text, width);
  }
}
