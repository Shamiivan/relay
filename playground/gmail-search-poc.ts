import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ClarificationRequest, DoneForNow } from "../runtime/src/execution/determine-next-step/contract.ts";
import { buildExplicitDetermineNextStepPrompt } from "../runtime/src/execution/determine-next-step/explicit.ts";
import { Thread } from "../runtime/src/primitives/thread.ts";
import { gmailSearchPocTool } from "../tools/gworkspace/gmail/gmail.search.poc/tool.ts";

function getUserInput(): string {
  const input = process.argv
    .slice(2)
    .filter((arg) => arg !== "--")
    .join(" ")
    .trim();

  if (!input) {
    throw new Error("Usage: pnpm tsx playground/gmail-search-poc.ts -- \"your message\"");
  }

  return input;
}

async function main() {
  const input = getUserInput();
  const thread = new Thread({
    state: {},
    events: [
      {
        type: "user_message",
        data: input,
      },
    ],
  });

  const determineNextStepContract = [
    ClarificationRequest,
    DoneForNow,
    gmailSearchPocTool.intent,
  ] as const;

  const toolPromptSection = await gmailSearchPocTool.renderPromptSection();
  const prompt = buildExplicitDetermineNextStepPrompt({
    thread,
    contract: determineNextStepContract,
    sections: [
      {
        title: "Available Tools",
        body: toolPromptSection,
      },
    ],
  });

  const outputDir = path.join(process.cwd(), ".relay", "mockups", "gmail-search-poc");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `${new Date().toISOString().replace(/[:.]/g, "-")}.md`,
  );

  writeFileSync(outputPath, prompt);

  console.log(prompt);
  console.log(`\nSaved to ${outputPath}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
