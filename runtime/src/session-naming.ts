const LEADING_FILLER_WORDS = new Set([
  "alright",
  "hello",
  "hey",
  "hi",
  "just",
  "ok",
  "okay",
  "please",
  "pls",
  "thanks",
  "there",
  "yo",
]);

const LEADING_FILLER_PHRASES = [
  ["can", "we"],
  ["can", "you"],
  ["could", "we"],
  ["could", "you"],
  ["would", "we"],
  ["would", "you"],
  ["help", "me"],
  ["i", "need", "you", "to"],
];

const SLUG_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "could",
  "for",
  "from",
  "get",
  "have",
  "hello",
  "help",
  "hey",
  "hi",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "just",
  "me",
  "my",
  "of",
  "ok",
  "okay",
  "on",
  "or",
  "please",
  "pls",
  "so",
  "thanks",
  "that",
  "the",
  "there",
  "this",
  "to",
  "us",
  "we",
  "what",
  "where",
  "with",
  "would",
  "you",
  "your",
]);

function normalizeMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

function truncateAtWordBoundary(message: string, maxLength: number): string {
  if (message.length <= maxLength) return message;
  const truncated = message.slice(0, maxLength).trim();
  const boundary = truncated.lastIndexOf(" ");
  return (boundary > 20 ? truncated.slice(0, boundary) : truncated).trim();
}

function startsWithPhrase(words: string[], phrase: string[]): boolean {
  if (words.length < phrase.length) return false;
  return phrase.every((word, index) => words[index] === word);
}

function stripLeadingFiller(message: string): string {
  const words = (message.toLowerCase().match(/[a-z0-9]+/g) ?? []).slice();
  let index = 0;

  while (index < words.length) {
    const remainingWords = words.slice(index);
    const matchingPhrase = LEADING_FILLER_PHRASES.find((phrase) => startsWithPhrase(remainingWords, phrase));

    if (matchingPhrase) {
      index += matchingPhrase.length;
      continue;
    }

    if (LEADING_FILLER_WORDS.has(words[index])) {
      index += 1;
      continue;
    }

    break;
  }

  if (index === 0) return message;

  const meaningfulWords = words.slice(index);
  return meaningfulWords.join(" ");
}

function buildSlugTokens(message: string): string[] {
  const rawTokens = message.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const meaningfulTokens = rawTokens.filter((token) => !SLUG_STOP_WORDS.has(token));
  return (meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens).slice(0, 6);
}

export function deriveSessionName(message: string): { displayName: string; slug: string } {
  const normalized = normalizeMessage(message);
  const cleaned = stripLeadingFiller(normalized);
  const baseName = cleaned || normalized || "session";
  const displayName = truncateAtWordBoundary(baseName, 72) || "session";
  const slugTokens = buildSlugTokens(baseName);
  const slug = slugTokens.join("-") || "session";

  return { displayName, slug };
}
