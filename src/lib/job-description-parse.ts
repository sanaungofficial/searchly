export type ParsedJobSections = {
  summary: string;
  responsibilities: string[];
  requiredQualifications: string[];
  preferredQualifications: string[];
  benefits: string[];
};

const EMPTY: ParsedJobSections = {
  summary: "",
  responsibilities: [],
  requiredQualifications: [],
  preferredQualifications: [],
  benefits: [],
};

type SectionKey = keyof Omit<ParsedJobSections, "summary">;

const SECTION_HEADERS: Array<{ key: SectionKey; patterns: RegExp[] }> = [
  {
    key: "responsibilities",
    patterns: [
      /^key responsibilities/i,
      /^responsibilities/i,
      /^what you('ll| will) do/i,
      /^what you'll do/i,
      /^duties/i,
      /^the role/i,
      /^role overview/i,
      /^in this role/i,
    ],
  },
  {
    key: "requiredQualifications",
    patterns: [
      /^required qualifications/i,
      /^minimum qualifications/i,
      /^basic qualifications/i,
      /^requirements/i,
      /^qualifications/i,
      /^what you('ll| will) need/i,
      /^what we('re| are) looking for/i,
      /^you have/i,
      /^must have/i,
    ],
  },
  {
    key: "preferredQualifications",
    patterns: [
      /^preferred qualifications/i,
      /^desired qualifications/i,
      /^nice to have/i,
      /^bonus/i,
      /^pluses/i,
    ],
  },
  {
    key: "benefits",
    patterns: [
      /^benefits/i,
      /^what we offer/i,
      /^perks/i,
      /^compensation & benefits/i,
      /^why join/i,
    ],
  },
];

function normalizeBullet(line: string): string {
  return line.replace(/^[\s•·▪◦\-*–—]+/, "").replace(/^\d+[.)]\s+/, "").trim();
}

function isBulletLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return /^[\s•·▪◦\-*–—]/.test(t) || /^\d+[.)]\s+/.test(t);
}

function linesToBullets(lines: string[]): string[] {
  const bullets: string[] = [];
  let paragraph = "";

  const flushParagraph = () => {
    const t = paragraph.trim();
    if (t.length >= 20 && t.length <= 600) bullets.push(t);
    paragraph = "";
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (isBulletLine(line)) {
      flushParagraph();
      const bullet = normalizeBullet(line);
      if (bullet.length >= 8 && bullet.length <= 600) bullets.push(bullet);
    } else if (line.length <= 180) {
      flushParagraph();
      bullets.push(line);
    } else {
      paragraph = paragraph ? `${paragraph} ${line}` : line;
    }
  }
  flushParagraph();

  return [...new Set(bullets)].slice(0, 24);
}

function detectSectionHeader(line: string): SectionKey | "summary" | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return null;
  const withoutColon = trimmed.replace(/:$/, "").trim();
  for (const section of SECTION_HEADERS) {
    if (section.patterns.some((p) => p.test(withoutColon))) return section.key;
  }
  if (/^about (the role|this role|the job|us)/i.test(withoutColon)) return "summary";
  if (/^job summary/i.test(withoutColon)) return "summary";
  if (/^overview/i.test(withoutColon)) return "summary";
  return null;
}

/** Split a plain-text job posting into structured sections for the drawer UI. */
export function parseJobDescriptionSections(text: string | null | undefined): ParsedJobSections {
  if (!text?.trim()) return EMPTY;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\t/g, " ");
  const lines = normalized.split("\n");

  const sections: Record<SectionKey | "summary", string[]> = {
    summary: [],
    responsibilities: [],
    requiredQualifications: [],
    preferredQualifications: [],
    benefits: [],
  };

  let current: SectionKey | "summary" = "summary";
  let buffer: string[] = [];

  const flush = () => {
    if (!buffer.length) return;
    if (current === "summary") {
      const joined = buffer.join(" ").replace(/\s+/g, " ").trim();
      if (joined.length >= 20) sections.summary.push(joined);
    } else {
      sections[current].push(...linesToBullets(buffer));
    }
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const header = detectSectionHeader(line);
    if (header) {
      flush();
      current = header;
      continue;
    }
    buffer.push(line);
  }
  flush();

  const summary =
    sections.summary.join(" ").trim() ||
    normalized.split(/\n\n+/)[0]?.replace(/\s+/g, " ").trim().slice(0, 480) ||
    "";

  return {
    summary,
    responsibilities: [...new Set(sections.responsibilities)].slice(0, 20),
    requiredQualifications: [...new Set(sections.requiredQualifications)].slice(0, 20),
    preferredQualifications: [...new Set(sections.preferredQualifications)].slice(0, 16),
    benefits: [...new Set(sections.benefits)].slice(0, 16),
  };
}

export function hasParsedJobSections(parsed: ParsedJobSections): boolean {
  return (
    parsed.responsibilities.length > 0 ||
    parsed.requiredQualifications.length > 0 ||
    parsed.preferredQualifications.length > 0 ||
    parsed.benefits.length > 0
  );
}
