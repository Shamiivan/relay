import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ContextSection } from "../context/sections.ts";
import type { IntentDeclaration } from "../execution/determine-next-step/contract.ts";
import type { Tool } from "../../../tools/sdk-class.ts";
import type { Task } from "./task.ts";
import type { ThreadData } from "../primitives/thread.ts";

export class Workflow {
  readonly name: string;
  readonly intent: IntentDeclaration;
  readonly tasks: Task[];
  readonly tools: Tool[];
  readonly terminalIntents: readonly IntentDeclaration[];
  readonly promptFiles: readonly string[];
  readonly moduleUrl: string;

  constructor(args: {
    name: string;
    intent: IntentDeclaration;
    tasks?: Task[];
    tools: Tool[];
    terminalIntents: readonly IntentDeclaration[];
    promptFiles?: readonly string[];
    moduleUrl: string;
  }) {
    this.name = args.name;
    this.intent = args.intent;
    this.tasks = args.tasks ?? [];
    this.tools = args.tools;
    this.terminalIntents = args.terminalIntents;
    this.promptFiles = args.promptFiles ?? [];
    this.moduleUrl = args.moduleUrl;
  }

  get contract(): readonly IntentDeclaration[] {
    return [
      ...this.terminalIntents,
      ...this.tasks.map((task) => task.intent),
      ...this.tools.map((tool) => tool.intent),
    ];
  }

  get executables(): Array<Task | Tool> {
    return [...this.tasks, ...this.tools];
  }

  getExecutable(name: string): Task | Tool | undefined {
    return this.executables.find((executable) => executable.name === name);
  }

  async runExecutable(name: string, input: ThreadData): Promise<ThreadData> {
    const executable = this.getExecutable(name);
    if (!executable) {
      throw new Error(`Unknown executable: ${name}`);
    }

    return await executable.run(input) as ThreadData;
  }

  async renderWorkflowPromptSection(): Promise<string> {
    const parts = await Promise.all(
      this.promptFiles.map(async (file) => {
        const content = await fs.readFile(fileURLToPath(new URL(file, this.moduleUrl)), "utf8");
        return content.trim();
      }),
    );

    return parts.filter(Boolean).join("\n\n").trim();
  }

  async buildContextSections(): Promise<ContextSection[]> {
    const [workflowPrompt, taskPrompt, toolPrompt] = await Promise.all([
      this.renderWorkflowPromptSection(),
      Promise.all(this.tasks.map(async (task) => await task.renderPromptSection())),
      Promise.all(this.tools.map(async (tool) => await tool.renderPromptSection())),
    ]);

    return [
      {
        title: "Workflow",
        body: workflowPrompt,
      },
      {
        title: "Available Tasks",
        body: taskPrompt.filter(Boolean).join("\n\n"),
      },
      {
        title: "Available Tools",
        body: toolPrompt.filter(Boolean).join("\n\n"),
      },
    ].filter((section) => Boolean(section.body));
  }
}
