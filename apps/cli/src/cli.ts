import cac from "cac";

export async function runCli(argv = process.argv): Promise<void> {
  const cli = cac("relay");

  cli
    .command("run [...prompt]", "Run the agent one-shot")
    .action(async (prompt: string[]) => {
      const { runCommand } = await import("./commands/run");
      await runCommand(prompt);
    });

  cli
    .command("tui", "Open the interactive TUI shell")
    .action(async () => {
      const { tuiCommand } = await import("./commands/tui");
      await tuiCommand();
    });

  cli
    .command("inspector", "Open the Ink inspector")
    .action(async () => {
      const { inspectorCommand } = await import("./commands/inspector");
      await inspectorCommand();
    });

  cli
    .command("[...prompt]", "Run agent one-shot or open interactive TUI")
    .action(async (prompt: string[]) => {
      if (prompt.length > 0) {
        const { runCommand } = await import("./commands/run");
        await runCommand(prompt);
        return;
      }

      const { tuiCommand } = await import("./commands/tui");
      await tuiCommand();
    });

  cli.help();
  cli.parse(argv);
}
