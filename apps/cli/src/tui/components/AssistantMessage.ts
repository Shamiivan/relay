import { MarkdownComponent } from "../../../../../packages/tui/src/index.ts";

export class AssistantMessage extends MarkdownComponent {
  constructor(text: string) {
    super(`\u001b[32mRelay\u001b[39m\n${text}`);
  }
}
