import { TextComponent } from "../../../../../packages/tui/src/index.ts";

export class ToolCallComponent extends TextComponent {
  constructor(toolName: string, status: string, result?: string) {
    const summary = result ? `\n${result}` : "";
    super(`\u001b[33mTool\u001b[39m  ${toolName} [${status}]${summary}`);
  }
}
