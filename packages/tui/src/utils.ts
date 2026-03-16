export function wrapTextWithAnsi(text: string, width: number): string[] {
  if (!text) {
    return [""];
  }

  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine.length <= width) {
      lines.push(rawLine);
      continue;
    }

    let remaining = rawLine;
    while (remaining.length > width) {
      lines.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
    lines.push(remaining);
  }

  return lines;
}
