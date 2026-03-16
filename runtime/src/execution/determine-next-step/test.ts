import test from "node:test";
import assert from "node:assert/strict";
import { Thread } from "../../primitives/thread";
import { determineNextStepContract } from "./contract";
import {
  buildDetermineNextStepPrompt,
  determineNextStepSchema,
  parseJsonResponse,
  renderOutputFormat,
} from "./compiler";

function createThread(message: string) {
  return new Thread({
    session: {} as never,
    run: {} as never,
    state: {},
    events: [
      {
        type: "user_message",
        data: message,
      },
    ],
  });
}

test("renderOutputFormat compiles the intent contract into prompt text", () => {
  const outputFormat = renderOutputFormat(determineNextStepContract);

  assert.match(outputFormat, /Answer in JSON using any of these schemas:/);
  assert.match(outputFormat, /intent: "request_more_information"/);
  assert.match(outputFormat, /intent: "done_for_now"/);
  assert.match(outputFormat, /you can request more information from me/);
  assert.match(outputFormat, /message to send to the user about the work that was done\./);
});

test("buildDetermineNextStepPrompt includes the serialized thread and output format", () => {
  const prompt = buildDetermineNextStepPrompt(createThread("hi there"));

  assert.match(prompt, /<user_message>\nhi there\n<\/user_message>/);
  assert.match(prompt, /Answer in JSON using any of these schemas:/);
  assert.match(prompt, /Return JSON only\./);
});

test("parseJsonResponse accepts fenced JSON", () => {
  const parsed = parseJsonResponse('```json\n{"intent":"done_for_now","message":"done"}\n```');

  assert.deepEqual(parsed, {
    intent: "done_for_now",
    message: "done",
  });
});

test("determineNextStepSchema parses valid contract outputs", () => {
  const parsed = determineNextStepSchema.parse({
    intent: "request_more_information",
    message: "What did you mean?",
  });

  assert.deepEqual(parsed, {
    intent: "request_more_information",
    message: "What did you mean?",
  });
});

test("determineNextStepSchema rejects invalid outputs", () => {
  assert.throws(() => {
    determineNextStepSchema.parse({
      intent: "done_for_now",
    });
  });
});
