type RelayEvent =
  | { type: "user_message"; text: string }
  | { type: "assistant_message"; text: string }
  | { type: "tool_call"; toolName: string; ok: boolean };

type ThreadStats = {
  userMessages: number;
  assistantMessages: number;
  failedToolCalls: number;
};

const thread: RelayEvent[] = [
  { type: "user_message", text: "Plan my follow-up email." },
  { type: "assistant_message", text: "I can help with that." },
  { type: "tool_call", toolName: "gmail.search", ok: true },
  { type: "tool_call", toolName: "gsheets.appendRow", ok: false },
];

function collectStats(events: RelayEvent[]): ThreadStats {
  let userMessages = 0;
  let assistantMessages = 0;
  let failedToolCalls = 0;

  for (const event of events) {
    if (event.type === "user_message") {
      userMessages += 1;
    }

    if (event.type === "assistant_message") {
      assistantMessages += 1;
    }

    if (event.type === "tool_call" && !event.ok) {
      failedToolCalls += 1;
    }
  }

  return {
    userMessages,
    assistantMessages,
    failedToolCalls,
  };
}

function chooseNextStep(stats: ThreadStats): string {
  if (stats.failedToolCalls > 0) {
    return "retry_or_explain_failure";
  }

  if (stats.assistantMessages === 0) {
    return "draft_first_response";
  }

  return "continue";
}

function main() {
  const stats = collectStats(thread);
  const nextStep = chooseNextStep(stats);

  console.log("Thread stats:", stats);
  console.log("Next step:", nextStep);
}

main();
