import { execSync } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { defineTool, runDeclaredTool } from "../../sdk";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const LOCAL_LOGS = path.join(REPO_ROOT, ".production/logs");
const VM_NAME = "relay-bot";
const VM_ZONE = "us-east1-b";
const VM_PROJECT = "relay-bot-prod";
const REMOTE_RUNS = "/home/relay/app/.runs/";

export const fetchLogsTool = defineTool({
  name: "production.fetch_logs",
  resource: "production",
  capability: "read",
  description: "Fetch run logs from the production VM into .production/logs/",
  idempotent: true,
  input: z.object({}),
  output: z.object({
    copied: z.number().describe("Number of entries copied"),
    destination: z.string(),
  }),
  async handler() {
    try {
      execSync("which gcloud", { stdio: "ignore" });
    } catch {
      throw new Error("gcloud is not installed or not in PATH. Install it from https://cloud.google.com/sdk/docs/install");
    }

    execSync(`mkdir -p "${LOCAL_LOGS}"`);

    execSync(
      `gcloud compute scp --recurse "${VM_NAME}:${REMOTE_RUNS}*" "${LOCAL_LOGS}/" --zone=${VM_ZONE} --project=${VM_PROJECT}`,
      { stdio: "inherit" },
    );

    const entries = execSync(`ls "${LOCAL_LOGS}"`).toString().trim().split("\n").filter(Boolean);

    return { copied: entries.length, destination: LOCAL_LOGS };
  },
  onError(error) {
    return { type: "tool_error", message: error instanceof Error ? error.message : "Unknown error" };
  },
});

if (import.meta.main) {
  void runDeclaredTool(fetchLogsTool);
}
