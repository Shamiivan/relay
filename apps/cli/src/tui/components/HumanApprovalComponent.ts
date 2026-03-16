import { TextComponent } from "../../../../../packages/tui/src/index.ts";

export class HumanApprovalComponent extends TextComponent {
  constructor(prompt: string) {
    super(`\u001b[35mHuman input required\u001b[39m\n${prompt}`);
  }
}
