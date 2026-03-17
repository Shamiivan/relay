export type ContextSection = {
  title?: string;
  body?: string | null | undefined;
};

function normalizeBody(body: string): string {
  return body.trim();
}

export function renderContextSection(section: ContextSection): string {
  const body = typeof section.body === "string" ? normalizeBody(section.body) : "";
  if (!body) {
    return "";
  }

  if (!section.title) {
    return body;
  }

  return `# ${section.title}\n${body}`;
}

export function composeContext(sections: ContextSection[]): string {
  return sections
    .map(renderContextSection)
    .filter(Boolean)
    .join("\n\n");
}
