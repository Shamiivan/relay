export async function readJsonInput(): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

export function writeJsonOutput(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
