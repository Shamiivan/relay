import { TextComponent } from "../../../../../packages/tui/src/index.ts";

export class UserMessage extends TextComponent {
  constructor(text: string) {
    super(`\u001b[36mYou\u001b[39m  ${text}`);
  }
}
