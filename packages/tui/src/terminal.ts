export class ProcessTerminal {
  private started = false;

  start(): void {
    if (this.started) {
      return;
    }

    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    this.started = true;
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    this.started = false;
  }

  onKeypressHandler(handler: (input: string, key: { ctrl?: boolean; name?: string }) => void): () => void {
    const wrapped = (chunk: Buffer | string) => {
      const value = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      handler(value, {
        ctrl: value === "\u0003",
        name: value === "\u0003" ? "c" : undefined,
      });
    };
    process.stdin.on("data", wrapped);
    return () => {
      process.stdin.off("data", wrapped);
    };
  }

  get width(): number {
    return process.stdout.columns ?? 80;
  }

  get height(): number {
    return process.stdout.rows ?? 24;
  }
}
