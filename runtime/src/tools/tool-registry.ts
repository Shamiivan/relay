import { allTools, getTool } from "../../../tools/_generated/registry";
import { getToolPrompt } from "../../../tools/_generated/prompts";
import type { ToolManifest } from "../../../tools/sdk";

export type { ToolManifest } from "../../../tools/sdk";

export function loadAllToolManifests(): ToolManifest[] {
  return [...allTools];
}

export function getAllowedTools(toolNames: string[]): ToolManifest[] {
  return toolNames.map((toolName) => {
    const tool = getTool(toolName);
    if (!tool) {
      throw new Error(`Unknown tool in specialist config: ${toolName}`);
    }

    return tool;
  });
}

export function getToolManifest(toolName: string): ToolManifest | undefined {
  return getTool(toolName);
}

export function loadToolPrompt(toolName: string): string {
  return getToolPrompt(toolName);
}
