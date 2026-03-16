import { TextComponent } from "../../../../../packages/tui/src/index.ts";

export class ErrorMessage extends TextComponent {
  constructor(text: string) {
    super(`\u001b[31mError\u001b[39m  ${text}`);
  }
}
