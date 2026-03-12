/**
 * Local worker that claims pending runs and executes them.
 * This keeps provider SDKs and filesystem access out of Convex.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { gmail } from "../../packages/adapters/gmail/src";
import type { GmailEnv, GmailSearchResult, SpecialistConfig } from "../../packages/contracts/src";
import { specialistConfigSchema } from "../../packages/contracts/src";
import { loadRuntimeEnv } from "./env";

function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

async function loadSpecialistConfig(specialistId: string): Promise<SpecialistConfig> {
  const raw = await fs.readFile(
    repoPath(`configs/specialists/${specialistId}.json`),
    "utf8",
  );

  return specialistConfigSchema.parse(JSON.parse(raw));
}

async function loadPrompt(promptFile: string): Promise<string> {
  return await fs.readFile(repoPath(promptFile), "utf8");
}

async function loadContext(contextFiles: string[]): Promise<string> {
  const chunks = await Promise.all(
    contextFiles.map(async (file) => {
      const content = await fs.readFile(repoPath(file), "utf8");
      return `# ${file}\n${content.trim()}`;
    }),
  );

  return chunks.join("\n\n").trim();
}

function formatSearchResult(result: GmailSearchResult): string {
  if (result.emails.length === 0) {
    return "No matching emails found.";
  }

  const lines = result.emails.map((email, index) => {
    const subject = email.subject || "(no subject)";
    const from = email.from || "unknown sender";
    const date = email.date || "unknown date";
    const snippet = email.snippet.trim();
    return `${index + 1}. ${subject} | ${from} | ${date}${snippet ? `\n${snippet}` : ""}`;
  });

  return [`Found ${result.total} matching emails.`, ...lines].join("\n");
}

async function processRun(
  convex: ConvexClient,
  run: Doc<"runs">,
  env: GmailEnv,
): Promise<void> {
  try {
    const specialist = await loadSpecialistConfig(run.specialistId);
    await loadPrompt(specialist.promptFile);
    await loadContext(specialist.contextFiles);

    const result = await gmail.actions.search.execute(
      { query: run.message, maxResults: 5 },
      env,
    );

    if (!result.ok) {
      await convex.mutation(api.events.append, {
        runId: run._id,
        kind: "run_error",
        text: result.error.type,
      });
      await convex.mutation(api.runs.fail, {
        runId: run._id,
        errorType: result.error.type,
        errorMessage: "Gmail search failed",
      });
      return;
    }

    const outputText = formatSearchResult(result.data);
    await convex.mutation(api.events.append, {
      runId: run._id,
      kind: "tool_result",
      text: JSON.stringify(result.data),
    });
    await convex.mutation(api.events.append, {
      runId: run._id,
      kind: "agent_output",
      text: outputText,
    });
    await convex.mutation(api.runs.finish, {
      runId: run._id,
      outputText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker failure";
    await convex.mutation(api.events.append, {
      runId: run._id,
      kind: "run_error",
      text: message,
    });
    await convex.mutation(api.runs.fail, {
      runId: run._id,
      errorType: "internal_error",
      errorMessage: message,
    });
  }
}

export function startWorker(): void {
  const env = loadRuntimeEnv();
  const convex = new ConvexClient(env.CONVEX_URL);

  convex.onUpdate(api.runs.listPending, {}, async (pendingRuns) => {
    if (pendingRuns.length === 0) {
      return;
    }

    for (;;) {
      const run = await convex.mutation(api.runs.claim, {});
      if (!run) {
        break;
      }

      await processRun(convex, run, env);
    }
  });

  console.log("Relay worker listening for pending runs");
}

startWorker();
