export class JsonStdinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonStdinError";
  }
}

export async function readJsonInput(): Promise<unknown> {
  if (process.stdin.isTTY) {
    throw new JsonStdinError("Expected JSON on stdin. This tool does not accept interactive empty input. Pipe '{}' for tools with no arguments.");
  }

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    throw new JsonStdinError("Expected JSON on stdin. Provide '{}' for tools with no arguments.");
  }
  return JSON.parse(text);
}

export function writeJsonOutput(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
