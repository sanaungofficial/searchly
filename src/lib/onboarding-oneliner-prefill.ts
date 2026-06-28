export function firstSentence(text: string, maxLen = 220): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const sentence = trimmed.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? trimmed;
  return sentence.length > maxLen ? `${sentence.slice(0, maxLen - 1).trim()}…` : sentence;
}

export type OnelinerPrefillSource = "headline" | "summary";

export function extractOnelinerPrefill(input: {
  headline?: string | null;
  summary?: string | null;
}): { text: string; source: OnelinerPrefillSource } | null {
  const headline = input.headline?.trim();
  if (headline) return { text: headline, source: "headline" };
  const summary = input.summary?.trim();
  if (summary) return { text: firstSentence(summary), source: "summary" };
  return null;
}

export function onelinerPrefillSuccessMessage(source: OnelinerPrefillSource, origin: "linkedin" | "resume"): string {
  if (origin === "linkedin") {
    return source === "headline"
      ? "LinkedIn imported — we prefilled your one-liner from your headline."
      : "LinkedIn imported — we prefilled your one-liner from your profile summary.";
  }
  return source === "headline"
    ? "Resume analyzed — we prefilled your one-liner from your headline."
    : "Resume analyzed — we prefilled your one-liner from your professional summary.";
}
