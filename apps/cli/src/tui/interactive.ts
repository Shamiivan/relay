import { Container, InputComponent, LoaderComponent, ProcessTerminal, Tui } from "../../../../packages/tui/src/index.ts";
import type { TuiTransport } from "../../../../packages/transport/src/tui.ts";
import { UserMessage } from "./components/UserMessage";
import { ThreadRenderer } from "./thread";

export async function runInteractiveShell(transport: TuiTransport): Promise<void> {
  const terminal = new ProcessTerminal();
  const chatContainer = new Container({ gap: 1 });
  const statusContainer = new Container();
  let tui: Tui | null = null;
  let inFlight = false;

  const input = new InputComponent({
    prompt: "> ",
    placeholder: "Ask Relay something",
    onSubmit: async (value) => {
      const message = value.trim();
      if (!message || inFlight) {
        return;
      }

      inFlight = true;
      input.setDisabled(true);
      chatContainer.addChild(new UserMessage(message));
      statusContainer.setChildren([new LoaderComponent("queued...")]);
      tui?.requestRender();

      const { runId } = await transport.submit(message);
      renderer.watchRun(runId);
    },
  });
  const root = new Container({ gap: 1 });
  root.addChild(chatContainer);
  root.addChild(statusContainer);
  root.addChild(input);
  tui = new Tui(terminal, root);

  const renderer = new ThreadRenderer({
    transport,
    chatContainer,
    statusContainer,
    requestRender: () => tui?.requestRender(),
    onRunSettled: () => {
      inFlight = false;
      input.setDisabled(false);
      input.focus();
    },
  });

  tui.start();
  input.focus();
  tui.requestRender();

  await new Promise<void>((resolve) => {
    const stopKeys = terminal.onKeypressHandler((inputValue, key) => {
      if (key.ctrl && key.name === "c") {
        stopKeys();
        renderer.stop();
        tui?.close();
        resolve();
        return;
      }

      if (input.handleKey(inputValue, key)) {
        tui?.requestRender();
      }
    });
  });
}
