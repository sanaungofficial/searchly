export type ApplicationQaEntry = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export function normalizeQaTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.slice(0, 12);
}

export function parseTagsInput(input: string): string[] {
  return normalizeQaTags(input.split(/[,;]+/));
}

export function serializeApplicationQaEntry(row: {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}): ApplicationQaEntry {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    tags: normalizeQaTags(row.tags),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function collectUniqueTags(entries: ApplicationQaEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}
