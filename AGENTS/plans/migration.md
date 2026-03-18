Okay, so basically I want to unread the idea of 12-factor engines. We want to have, like, mechanisms for stop engines. We want to have mechanisms for, um, what else? Uh, uh, like, essentially, depending on that step, and always being able to log the next step into memory. Um, and for us, the way we were depending on that step, or the way we got that step into memory, is really by looking at the markdown file for whatever over that we have, and then, um, like, depending on what we have, choosing the next, like, the next step. So, um, I would like to try to make this, like, predictable. 


we are buildin on top of pi-mono but we can modify it as we want. 

```typescript
// index
import { agentLoop, Thread } from "./agent";
import * as readline from "readline";

async function askHuman(message: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(`${message}\n> `, (answer: string) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function main() {
    const message = process.argv.slice(2).join(" ");
    if (!message) {
        console.error("Usage: npx tsx src/index.ts '<message>'");
        process.exit(1);
    }

    const thread = new Thread([{ type: "user_input", data: message }]);

    let result = await agentLoop(thread);
    let lastEvent = result.events.slice(-1)[0];

    while (lastEvent.data.intent === "request_more_information") {
        const response = await askHuman(lastEvent.data.message);
        thread.events.push({ type: "human_response", data: response });
        result = await agentLoop(thread);
        lastEvent = result.events.slice(-1)[0];
    }

    console.log(lastEvent.data.message);
    process.exit(0);
}

main().catch(console.error);
```

```typescript
//agent loop
import { b } from "../baml_client";

export interface Event {
    type: string;
    data: any;
}

export class Thread {
    events: Event[] = [];

    constructor(_events: Event[]) {
        this.events = _events;
    }

    _serializeForLLM() {
        return this.events.map(e => this.serializeOneEvent(e)).join("\n");
    }

    trimLeadingWhitespace(s: string) {
        return s.replace(/^[ \t]+/gm, '');
    }

    serializeOneEvent(e: Event) {
        return this.trimLeadingWhitespace(`
            <${e.data?.intent || e.type}>
            ${
            typeof e.data !== 'object' ? e.data :
            Object.keys(e.data).filter(k => k !== 'intent').map(k => `${k}: ${e.data[k]}`).join("\n")}
            </${e.data?.intent || e.type}>
        `)
    }
}

export async function agentLoop(thread: Thread): Promise<Thread> {
    while (true) {
        const nextStep = await b.DetermineNextStep(thread._serializeForLLM());
        console.log("Determining next step", nextStep);
        thread.events.push({ type: "tool_call", data: nextStep });

        switch (nextStep.intent) {
            case "done_for_now":
            case "request_more_information":
                return thread;

            case "add":
                const result = nextStep.a + nextStep.b;
                thread.events.push({ type: "tool_response", data: result });
                console.log("Result", result);
                continue;
            case "subtract":
                const resultSubtract = nextStep.a - nextStep.b;
                thread.events.push({ type: "tool_response", data: resultSubtract });
                console.log("Result", resultSubtract);
                continue;
            case "multiply":
                const resultMultiply = nextStep.a * nextStep.b;
                thread.events.push({ type: "tool_response", data: resultMultiply });
                console.log("Result", resultMultiply);
                continue;
            case "divide":
                // divide is scary, return thread for human approval
                return thread;

            default:
                throw new Error("Could not find the right step");
        }
    }
}

```

class ClarificationRequest {
    intent "request_more_information" @description("you can request more information from me")
    message string
}

class DoneForNow {
    intent "done_for_now"
    message string @description(#"
        message to send to the user about the work that was done.
    "#)
}

```baml
type HumanTools = ClarificationRequest | DoneForNow

function DetermineNextStep(thread: string) -> HumanTools | CalculatorTools {
    client "google-ai/gemini-2.5-flash"
    prompt #"
        {{ _.role("system") }}
        You are a helpful assistant that can help with tasks.

        {{ _.role("user") }}
        You are working on the following thread:

        {{ thread }}

        What should the next step be?

        {{ ctx.output_format }}

        Always think about what to do next first, like:

        - ...
        - ...
        - ...

        {...} // schema
    "#
}
```


```
board meeting prep
---
intent: board_meeting_prep
description: Prepare or revise board meeting documents using Google Drive and Docs
fields:
---
You are running the board meeting preparation workflow.

Use Drive and Docs tools directly when the workflow step requires them.

Rules:
- Prefer the most recent strong board-related document as the reference when no explicit user preference is given.
- Keep concrete metadata attached to files: file name, mime type, modified time, and Drive link when available.
- When revising the working document, preserve the structure and tone of the current document unless the user explicitly asks for a structural change.
- Return plain text only from any generation step.
- Read the last 2 board meeting agendas and board meeting minutes to understand the context of the board meeting.
```


```
simple example user flow 


node:internal/modules/run_main:107
    triggerUncaughtException(
    ^
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/shami/workspaces/ai-that-works/2025-04-22-twelve-factor-agents/step-by-step/cli' imported from /home/shami/workspaces/ai-that-works/2025-04-22-twelve-factor-agents/step-by-step/
    at finalizeResolution (node:internal/modules/esm/resolve:275:11)
    at moduleResolve (node:internal/modules/esm/resolve:865:10)
    at defaultResolve (node:internal/modules/esm/resolve:991:11)
    at nextResolve (node:internal/modules/esm/hooks:769:28)
    at resolveBase (file:///home/shami/workspaces/ai-that-works/2025-04-22-twelve-factor-agents/step-by-step/node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/esm/index.mjs?1773872798392:2:3744)
    at async resolveDirectory (file:///home/shami/workspaces/ai-that-works/2025-04-22-twelve-factor-agents/step-by-step/node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/esm/index.mjs?1773872798392:2:4237)
    at async resolve (file:///home/shami/workspaces/ai-that-works/2025-04-22-twelve-factor-agents/step-by-step/node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/esm/index.mjs?1773872798392:2:5355)
    at async nextResolve (node:internal/modules/esm/hooks:769:22)
    at async AsyncLoaderHooksOnLoaderHookWorker.resolve (node:internal/modules/esm/hooks:265:24)
    at async handleMessage (node:internal/modules/esm/worker:251:18) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/shami/workspaces/ai-that-works/2025-04-22-twelve-factor-agents/step-by-step/cli'
}

Node.js v25.6.1
❯ npx tsx src/index.ts  "hey there"
2026-03-18T18:26:59.498 [BAML INFO] Function DetermineNextStep:
    Client: google-ai/gemini-2.5-flash (gemini-2.5-flash) - 1424ms. StopReason: STOP. Tokens(in/out): 256/53
    ---PROMPT---
    system: You are a helpful assistant that can help with tasks.
    user: You are working on the following thread:


    <user_input>
    hey there
    </user_input>


    What should the next step be?

    Answer in JSON using any of these schemas:
    {
      // you can request more information from me
      intent: "request_more_information",
      message: string,
    } or {
      intent: "done_for_now",
      // message to send to the user about the work that was done.
      message: string,
    } or {
      intent: "add",
      a: int or float,
      b: int or float,
    } or {
      intent: "subtract",
      a: int or float,
      b: int or float,
    } or {
      intent: "multiply",
      a: int or float,
      b: int or float,
    } or {
      intent: "divide",
      a: int or float,
      b: int or float,
    }

    Always think about what to do next first, like:

    - ...
    - ...
    - ...

    {...} // schema

    ---LLM REPLY---
    ```json
    {
      "intent": "request_more_information",
      "message": "Hi there! How can I help you today? I can help with basic math operations like addition, subtraction, multiplication, and division."
    }
    ```
    ---Parsed Response (class ClarificationRequest)---
    {
      "intent": "request_more_information",
      "message": "Hi there! How can I help you today? I can help with basic math operations like addition, subtraction, multiplication, and division."
    }
Determining next step {
  intent: 'request_more_information',
  message: 'Hi there! How can I help you today? I can help with basic math operations like addition, subtraction, multiplication, and division.'
}
Hi there! How can I help you today? I can help with basic math operations like addition, subtraction, multiplication, and division.
> hmm lets add 3 + 4 + 5 * multiplier of thigns
2026-03-18T18:27:47.211 [BAML INFO] Function DetermineNextStep:
    Client: google-ai/gemini-2.5-flash (gemini-2.5-flash) - 6167ms. StopReason: STOP. Tokens(in/out): 331/59
    ---PROMPT---
    system: You are a helpful assistant that can help with tasks.
    user: You are working on the following thread:


    <user_input>
    hey there
    </user_input>


    <request_more_information>
    message: Hi there! How can I help you today? I can help with basic math operations like addition, subtraction, multiplication, and division.
    </request_more_information>


    <human_response>
    hmm lets add 3 + 4 + 5 * multiplier of thigns
    </human_response>


    What should the next step be?

    Answer in JSON using any of these schemas:
    {
      // you can request more information from me
      intent: "request_more_information",
      message: string,
    } or {
      intent: "done_for_now",
      // message to send to the user about the work that was done.
      message: string,
    } or {
      intent: "add",
      a: int or float,
      b: int or float,
    } or {
      intent: "subtract",
      a: int or float,
      b: int or float,
    } or {
      intent: "multiply",
      a: int or float,
      b: int or float,
    } or {
      intent: "divide",
      a: int or float,
      b: int or float,
    }

    Always think about what to do next first, like:

    - ...
    - ...
    - ...

    {...} // schema

    ---LLM REPLY---
    ```json
    {
      "intent": "request_more_information",
      "message": "It looks like you want to add 3 + 4 + 5 multiplied by something. Could you please specify what value 'multiplier of things' should be?"
    }
    ```
    ---Parsed Response (class ClarificationRequest)---
    {
      "intent": "request_more_information",
      "message": "It looks like you want to add 3 + 4 + 5 multiplied by something. Could you please specify what value 'multiplier of things' should be?"
    }
Determining next step {
  intent: 'request_more_information',
  message: "It looks like you want to add 3 + 4 + 5 multiplied by something. Could you please specify what value 'multiplier of things' should be?"
}
It looks like you want to add 3 + 4 + 5 multiplied by something. Could you please specify what value 'multiplier of things' should be?
> 5
2026-03-18T18:27:55.228 [BAML INFO] Function DetermineNextStep:
    Client: google-ai/gemini-2.5-flash (gemini-2.5-flash) - 1415ms. StopReason: STOP. Tokens(in/out): 397/31
    ---PROMPT---
    system: You are a helpful assistant that can help with tasks.
    user: You are working on the following thread:


    <user_input>
    hey there
    </user_input>


    <request_more_information>
    message: Hi there! How can I help you today? I can help with basic math operations like addition, subtraction, multiplication, and division.
    </request_more_information>


    <human_response>
    hmm lets add 3 + 4 + 5 * multiplier of thigns
    </human_response>


    <request_more_information>
    message: It looks like you want to add 3 + 4 + 5 multiplied by something. Could you please specify what value 'multiplier of things' should be?
    </request_more_information>


    <human_response>
    5
    </human_response>


    What should the next step be?

    Answer in JSON using any of these schemas:
    {
      // you can request more information from me
      intent: "request_more_information",
      message: string,
    } or {
      intent: "done_for_now",
      // message to send to the user about the work that was done.
      message: string,
    } or {
      intent: "add",
      a: int or float,
      b: int or float,
    } or {
      intent: "subtract",
      a: int or float,
      b: int or float,
    } or {
      intent: "multiply",
      a: int or float,
      b: int or float,
    } or {
      intent: "divide",
      a: int or float,
      b: int or float,
    }

    Always think about what to do next first, like:

    - ...
    - ...
    - ...

    {...} // schema

    ---LLM REPLY---
    ```json
    {
      "intent": "multiply",
      "a": 5,
      "b": 5
    }
    ```
    ---Parsed Response (class MultiplyTool)---
    {
      "intent": "multiply",
      "a": 5,
      "b": 5
    }
Determining next step { intent: 'multiply', a: 5, b: 5 }
Result 25
2026-03-18T18:27:56.637 [BAML INFO] Function DetermineNextStep:
    Client: google-ai/gemini-2.5-flash (gemini-2.5-flash) - 1402ms. StopReason: STOP. Tokens(in/out): 430/31
    ---PROMPT---
    system: You are a helpful assistant that can help with tasks.
    user: You are working on the following thread:


    <user_input>
    hey there
    </user_input>


    <request_more_information>
    message: Hi there! How can I help you today? I can help with basic math operations like addition, subtraction, multiplication, and division.
    </request_more_information>


    <human_response>
    hmm lets add 3 + 4 + 5 * multiplier of thigns
    </human_response>


    <request_more_information>
    message: It looks like you want to add 3 + 4 + 5 multiplied by something. Could you please specify what value 'multiplier of things' should be?
    </request_more_information>


    <human_response>
    5
    </human_response>


    <multiply>
    a: 5
    b: 5
    </multiply>


    <tool_response>
    25
    </tool_response>


    What should the next step be?

    Answer in JSON using any of these schemas:
    {
      // you can request more information from me
      intent: "request_more_information",
      message: string,
    } or {
      intent: "done_for_now",
      // message to send to the user about the work that was done.
      message: string,
    } or {
      intent: "add",
      a: int or float,
      b: int or float,
    } or {
      intent: "subtract",
      a: int or float,
      b: int or float,
    } or {
      intent: "multiply",
      a: int or float,
      b: int or float,
    } or {
      intent: "divide",
      a: int or float,
      b: int or float,
    }

    Always think about what to do next first, like:

    - ...
    - ...
    - ...

    {...} // schema

    ---LLM REPLY---
    ```json
    {
      "intent": "add",
      "a": 3,
      "b": 4
    }
    ```
    ---Parsed Response (class AddTool)---
    {
      "intent": "add",
      "a": 3,
      "b": 4
    }
Determining next step { intent: 'add', a: 3, b: 4 }
Result 7
2026-03-18T18:27:58.036 [BAML INFO] Function DetermineNextStep:
    Client: google-ai/gemini-2.5-flash (gemini-2.5-flash) - 1371ms. StopReason: STOP. Tokens(in/out): 462/32
    ---PROMPT---
    system: You are a helpful assistant that can help with tasks.
    user: You are working on the following thread:


    <user_input>
    hey there
    </user_input>


    <request_more_information>
    message: Hi there! How can I help you today? I can help with basic math operations like addition, subtraction, multiplication, and division.
    </request_more_information>


    <human_response>
    hmm lets add 3 + 4 + 5 * multiplier of thigns
    </human_response>


    <request_more_information>
    message: It looks like you want to add 3 + 4 + 5 multiplied by something. Could you please specify what value 'multiplier of things' should be?
    </request_more_information>


    <human_response>
    5
    </human_response>


    <multiply>
    a: 5
    b: 5
    </multiply>


    <tool_response>
    25
    </tool_response>


    <add>
    a: 3
    b: 4
    </add>


    <tool_response>
    7
    </tool_response>


    What should the next step be?

    Answer in JSON using any of these schemas:
    {
      // you can request more information from me
      intent: "request_more_information",
      message: string,
    } or {
      intent: "done_for_now",
      // message to send to the user about the work that was done.
      message: string,
    } or {
      intent: "add",
      a: int or float,
      b: int or float,
    } or {
      intent: "subtract",
      a: int or float,
      b: int or float,
    } or {
      intent: "multiply",
      a: int or float,
      b: int or float,
    } or {
      intent: "divide",
      a: int or float,
      b: int or float,
    }

    Always think about what to do next first, like:

    - ...
    - ...
    - ...

    {...} // schema

    ---LLM REPLY---
    ```json
    {
      "intent": "add",
      "a": 7,
      "b": 25
    }
    ```
    ---Parsed Response (class AddTool)---
    {
      "intent": "add",
      "a": 7,
      "b": 25
    }
Determining next step { intent: 'add', a: 7, b: 25 }
Result 32
2026-03-18T18:27:59.301 [BAML INFO] Function DetermineNextStep:
    Client: google-ai/gemini-2.5-flash (gemini-2.5-flash) - 1258ms. StopReason: STOP. Tokens(in/out): 496/45
    ---PROMPT---
    system: You are a helpful assistant that can help with tasks.
    user: You are working on the following thread:


    <user_input>
    hey there
    </user_input>


    <request_more_information>
    message: Hi there! How can I help you today? I can help with basic math operations like addition, subtraction, multiplication, and division.
    </request_more_information>


    <human_response>
    hmm lets add 3 + 4 + 5 * multiplier of thigns
    </human_response>


    <request_more_information>
    message: It looks like you want to add 3 + 4 + 5 multiplied by something. Could you please specify what value 'multiplier of things' should be?
    </request_more_information>


    <human_response>
    5
    </human_response>


    <multiply>
    a: 5
    b: 5
    </multiply>


    <tool_response>
    25
    </tool_response>


    <add>
    a: 3
    b: 4
    </add>


    <tool_response>
    7
    </tool_response>


    <add>
    a: 7
    b: 25
    </add>


    <tool_response>
    32
    </tool_response>


    What should the next step be?

    Answer in JSON using any of these schemas:
    {
      // you can request more information from me
      intent: "request_more_information",
      message: string,
    } or {
      intent: "done_for_now",
      // message to send to the user about the work that was done.
      message: string,
    } or {
      intent: "add",
      a: int or float,
      b: int or float,
    } or {
      intent: "subtract",
      a: int or float,
      b: int or float,
    } or {
      intent: "multiply",
      a: int or float,
      b: int or float,
    } or {
      intent: "divide",
      a: int or float,
      b: int or float,
    }

    Always think about what to do next first, like:

    - ...
    - ...
    - ...

    {...} // schema

    ---LLM REPLY---
    ```json
    {
      "intent": "done_for_now",
      "message": "The result of 3 + 4 + 5 * 5 is 32."
    }
    ```
    ---Parsed Response (class DoneForNow)---
    {
      "intent": "done_for_now",
      "message": "The result of 3 + 4 + 5 * 5 is 32."
    }
Determining next step {
  intent: 'done_for_now',
  message: 'The result of 3 + 4 + 5 * 5 is 32.'
}
The result of 3 + 4 + 5 * 5 is 32.
```