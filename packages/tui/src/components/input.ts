import type { Component } from "../container";
import { wrapTextWithAnsi } from "../utils";

type InputOptions = {
  prompt?: string;
  placeholder?: string;
  onSubmit: (value: string) => void | Promise<void>;
};

export class InputComponent implements Component {
  private value = "";
  private focused = true;
  private disabled = false;
  private readonly prompt: string;
  private readonly placeholder: string;
  private readonly onSubmit: (value: string) => void | Promise<void>;

  constructor(options: InputOptions) {
    this.prompt = options.prompt ?? "> ";
    this.placeholder = options.placeholder ?? "";
    this.onSubmit = options.onSubmit;
  }

  focus(): void {
    this.focused = true;
  }

  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
  }

  handleKey(input: string, key: { ctrl?: boolean; name?: string }): boolean {
    if (!this.focused || this.disabled) {
      return false;
    }

    if (key.name === "c" && key.ctrl) {
      return false;
    }

    if (input === "\r" || input === "\n") {
      const value = this.value;
      this.value = "";
      void this.onSubmit(value);
      return true;
    }

    if (input === "\u007f") {
      this.value = this.value.slice(0, -1);
      return true;
    }

    if (!input.startsWith("\x1b")) {
      this.value += input;
      return true;
    }

    return false;
  }

  render(width: number): string[] {
    const text = this.value || this.placeholder;
    return wrapTextWithAnsi(`${this.prompt}${text}`, width);
  }
}
