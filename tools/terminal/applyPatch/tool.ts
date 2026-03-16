import { z } from "zod";
import { defineTool, promptFile, runDeclaredTool, toolErrorSchema } from "../../sdk";
import { applyPatch } from "./apply-patch";

export const applyPatchTool = defineTool({
  name: "terminal.applyPatch",
  resource: "terminal",
  capability: "update",
  description:
    "Create, modify, or delete files using the *** Begin Patch / *** End Patch format. Always read files with terminal.bash before patching.",
  destructive: true,
  input: z.object({
    patch: z.string().min(1).describe(
      "Patch content in the *** Begin Patch / *** End Patch format. Paths must be relative. Include 3 lines of context above and below each change.",
    ),
  }),
  output: z.object({
    summary: z
      .object({
        added: z.array(z.string()),
        modified: z.array(z.string()),
        deleted: z.array(z.string()),
      })
      .optional(),
    error: toolErrorSchema.optional(),
  }),
  prompt: promptFile("./prompt.md"),
  async handler({ input }) {
    const result = await applyPatch(input.patch, { cwd: process.cwd() });
    return { summary: result.summary };
  },
  onError(error) {
    return {
      error: {
        type: "patch_error",
        message: error instanceof Error ? error.message : "Unknown patch error",
      },
    };
  },
});

if (import.meta.main) {
  void runDeclaredTool(applyPatchTool);
}
