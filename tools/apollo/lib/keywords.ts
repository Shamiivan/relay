/**
 * Apollo's q_keywords behaves more like free text than strict boolean search.
 * Normalize obvious boolean operators into plain terms before sending.
 */
export function normalizeApolloKeywords(rawValue: string): string {
  const normalized = rawValue
    .trim()
    .replace(/\b(?:and|or|not)\b/gi, " ")
    .replace(/[()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    throw new Error("keywords must contain at least one non-operator search term");
  }

  return normalized;
}
