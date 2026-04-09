export class JsonStdinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonStdinError";
  }
}

function escapeControlCharacter(char: string): string {
  switch (char) {
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\t":
      return "\\t";
    case "\b":
      return "\\b";
    case "\f":
      return "\\f";
    default:
      return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  }
}

export function sanitizeJsonText(text: string): string {
  let result = "";
  let inString = false;
  let escaping = false;

  for (const char of text) {
    if (inString) {
      if (escaping) {
        result += char;
        escaping = false;
        continue;
      }
      if (char === "\\") {
        result += char;
        escaping = true;
        continue;
      }
      if (char === "\"") {
        result += char;
        inString = false;
        continue;
      }
      if (char < " ") {
        result += escapeControlCharacter(char);
        continue;
      }
      result += char;
      continue;
    }

    if (char === "\"") {
      inString = true;
    }
    result += char;
  }

  return result;
}

export function parseJsonInputText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    return JSON.parse(sanitizeJsonText(text));
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
  return parseJsonInputText(text);
}

export function writeJsonOutput(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
