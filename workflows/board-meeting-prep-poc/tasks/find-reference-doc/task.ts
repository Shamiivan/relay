import { z } from "zod";
import { defineIntent, field } from "../../../../runtime/src/execution/determine-next-step/contract.ts";
import { Task } from "../../../../runtime/src/poc/task.ts";

const findReferenceDocInput = z.object({
  userRequest: z.string().min(1).describe("The user request to interpret."),
});

const findReferenceDocOutput = z.object({
  query: z.string(),
  maxResults: z.number().int().positive(),
  rationale: z.string(),
});

type FindReferenceDocInput = z.infer<typeof findReferenceDocInput>;
type FindReferenceDocOutput = z.infer<typeof findReferenceDocOutput>;

export class FindReferenceDocTask extends Task {
  readonly name = "find_reference_doc";

  readonly intent = defineIntent({
    name: "FindReferenceDoc",
    intent: "find_reference_doc",
    description: "Prepare the next Drive search for board-meeting reference documents.",
    fields: {
      userRequest: field.string("The user request to interpret."),
    },
  });

  readonly input = findReferenceDocInput;
  readonly output = findReferenceDocOutput;
  readonly promptFiles = ["./prompt.md"] as const;

  protected get moduleUrl(): string {
    return import.meta.url;
  }

  protected async execute(input: FindReferenceDocInput): Promise<FindReferenceDocOutput> {
    const text = input.userRequest.toLowerCase();
    const needsLatest = text.includes("latest") || text.includes("last") || text.includes("recent");

    return {
      query: "name contains 'board' and trashed = false",
      maxResults: needsLatest ? 5 : 10,
      rationale: needsLatest
        ? "Prefer a smaller recent board-related result set first."
        : "Use a broader board-related query to discover strong candidates.",
    };
  }
}

export const findReferenceDocTask = new FindReferenceDocTask();
