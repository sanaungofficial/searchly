import { prisma } from "@/lib/prisma";
import { buildResumeFingerprint } from "@/lib/role-gap";
import {
  normalizeParsedResumeData,
  type ParsedResumeData,
} from "@/lib/resume-parse";
import { Prisma } from "@prisma/client";

export const KIMCHI_META_SECTION_ID = "__kimchi_meta__";

export type ResumeSectionType = "text" | "bullets" | "header" | "meta";

export interface TailoredResumeSection {
  id: string;
  title: string;
  type: ResumeSectionType;
  content: string;
}

export interface ResumeDocument {
  personalInfo: string;
  sections: TailoredResumeSection[];
}

export interface TailoredSkillGroup {
  id: string;
  label: string;
  skills: string[];
}

const SKILLS_SECTION_RE = /skill|emphasis|competenc|core competency|qualification/i;

const SECTION_ALIASES: Array<{ pattern: RegExp; title: string; type: ResumeSectionType }> = [
  { pattern: /^professional\s+summary$/i, title: "Professional Summary", type: "text" },
  { pattern: /^summary$/i, title: "Professional Summary", type: "text" },
  { pattern: /^areas?\s+of\s+emphasis$/i, title: "Areas of Emphasis", type: "bullets" },
  { pattern: /^(core\s+)?skills(\s+(&|and)\s+tools?)?$/i, title: "Areas of Emphasis", type: "bullets" },
  { pattern: /^professional\s+experience$/i, title: "Professional Experience", type: "bullets" },
  { pattern: /^work\s+experience$/i, title: "Professional Experience", type: "bullets" },
  { pattern: /^experience$/i, title: "Professional Experience", type: "bullets" },
  { pattern: /^education(\s+(&|and)\s+certifications?)?$/i, title: "Education & Certifications", type: "bullets" },
  { pattern: /^education$/i, title: "Education & Certifications", type: "bullets" },
  { pattern: /^certifications?$/i, title: "Certification", type: "bullets" },
];

export function isSkillsEmphasisSection(section: TailoredResumeSection): boolean {
  return SKILLS_SECTION_RE.test(section.title);
}

/** Parse chip-oriented Areas of Emphasis content into labeled groups. */
export function parseSkillsSectionContent(content: string): TailoredSkillGroup[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [{ id: "sg_0", label: "Skills", skills: [] }];

  const groups: TailoredSkillGroup[] = [];
  let current: TailoredSkillGroup | null = null;

  for (const raw of lines) {
    const line = raw.replace(/^[-•*–]\s+/, "");
    const colonSplit = line.match(/^([^:]+):\s*(.+)$/);
    if (colonSplit) {
      if (current?.skills.length) groups.push(current);
      current = {
        id: `sg_${groups.length}`,
        label: colonSplit[1]!.trim(),
        skills: colonSplit[2]!.split(/[,;|·]/).map((s) => s.trim()).filter(Boolean),
      };
      continue;
    }
    const looksLikeGroupLabel =
      line.length <= 52 &&
      !/^[-•*]/.test(raw) &&
      (line.endsWith(":") ||
        (line.includes(" & ") && !/\([^)]{8,}\)/.test(line)) ||
        (/^[A-Z][A-Za-z0-9\s/&\-–—]+$/.test(line) &&
          line.split(/[,;|]/).length === 1 &&
          line.split(/\s+/).length <= 6 &&
          !/\(\)/.test(line) &&
          !/^\d/.test(line)));

    if (looksLikeGroupLabel) {
      if (current?.skills.length) groups.push(current);
      current = { id: `sg_${groups.length}`, label: line.replace(/:$/, ""), skills: [] };
      continue;
    }

    if (!current) current = { id: "sg_0", label: "Skills", skills: [] };
    current.skills.push(line);
  }

  if (current) groups.push(current);
  return groups.filter((g) => g.label || g.skills.length);
}

export function serializeSkillsSectionContent(groups: TailoredSkillGroup[]): string {
  return groups
    .flatMap((g) => {
      const header = g.label && g.label !== "Skills" ? [g.label] : [];
      return [...header, ...g.skills];
    })
    .join("\n");
}

export interface TailoredResumeMeta {
  sourceAssetId: string | null;
  sourceFingerprint: string;
  injectedKeywords?: string[];
  resumeStyle?: import("@/lib/resume-style").ResumeStyleSettings | null;
  /** AI change summaries from tailor flow */
  changes?: string[];
  previousScore?: number;
  newScore?: number;
}

function normalizeHeaderLine(line: string): string {
  return line.trim().replace(/^#{1,3}\s+/, "").replace(/[:.]+$/, "").trim();
}

function looksLikeContactLine(line: string): boolean {
  const t = line.trim();
  return !!(t.includes("|") || /^[\w.+-]+@/.test(t) || /linkedin\.com/i.test(t) || /^\(?\d{3}\)?[\s.-]?\d{3}/.test(t));
}

function looksLikeJobLine(line: string): boolean {
  const t = line.trim();
  return /\d{4}\s*[–—-]/.test(t) || /^[-•*–]\s/.test(t);
}

function titleFromHeader(line: string): string {
  return normalizeHeaderLine(line).split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function matchSectionHeader(line: string): { title: string; type: ResumeSectionType } | null {
  const t = normalizeHeaderLine(line);
  if (!t || t.length > 56 || looksLikeContactLine(t) || looksLikeJobLine(t)) return null;
  for (const alias of SECTION_ALIASES) {
    if (alias.pattern.test(t)) return { title: alias.title, type: alias.type };
  }
  if (/^[A-Z0-9][A-Z0-9\s&/.\-'()]+$/.test(t) && t.length <= 48 && t.split(/\s+/).length <= 6) {
    const titled = titleFromHeader(t);
    for (const alias of SECTION_ALIASES) {
      if (alias.pattern.test(titled)) return { title: alias.title, type: alias.type };
    }
    return { title: titled, type: /experience|skills|education|certification|emphasis/i.test(titled) ? "bullets" : "text" };
  }
  return null;
}

export function plainTextToResumeSections(text: string): TailoredResumeSection[] {
  return parseResumeDocument(text).sections;
}

export function parseResumeDocument(text: string): ResumeDocument {
  const trimmed = text.trim();
  if (!trimmed) return { personalInfo: "", sections: [] };
  const rawLines = trimmed.split(/\r?\n/);
  const sections: TailoredResumeSection[] = [];
  let i = 0;
  const headerLines: string[] = [];

  while (i < rawLines.length) {
    const t = (rawLines[i] ?? "").trim();
    if (!t) { i++; if (headerLines.length) break; continue; }
    if (matchSectionHeader(t)) break;
    headerLines.push(t);
    i++;
  }

  if (headerLines.length) {
    sections.push({ id: "header", title: "Personal Info", type: "header", content: headerLines.join("\n") });
  }

  while (i < rawLines.length) {
    while (i < rawLines.length && !rawLines[i]?.trim()) i++;
    if (i >= rawLines.length) break;
    const matched = matchSectionHeader((rawLines[i] ?? "").trim());
    if (!matched) {
      const orphan = rawLines.slice(i).map((l) => l.trim()).filter(Boolean).join("\n");
      if (orphan) sections.push({ id: `s-${sections.length}`, title: "Additional", type: "text", content: orphan });
      break;
    }
    i++;
    const contentLines: string[] = [];
    while (i < rawLines.length) {
      const peek = (rawLines[i] ?? "").trim();
      if (!peek) { i++; if (contentLines.length) break; continue; }
      if (matchSectionHeader(peek)) break;
      contentLines.push(peek.replace(/^[-•*–]\s+/, ""));
      i++;
    }
    sections.push({ id: `s-${sections.length}`, title: matched.title, type: matched.type, content: contentLines.join("\n") });
  }

  if (!sections.length) sections.push({ id: "body", title: "Resume", type: "text", content: trimmed });
  return { personalInfo: headerLines.join("\n"), sections };
}

/** Flatten editor sections back to plain text for export / AI routes. */
export function sectionsToPlainText(sections: TailoredResumeSection[]): string {
  const display = filterDisplaySections(sections);
  const parts: string[] = [];
  for (const s of display) {
    if (s.type === "header") {
      parts.push(s.content.trim());
    } else {
      const header = s.title.trim().toUpperCase();
      parts.push(`${header}\n${s.content.trim()}`);
    }
  }
  return parts.join("\n\n").trim();
}

export function filterDisplaySections(sections: unknown): TailoredResumeSection[] {
  if (!Array.isArray(sections)) return [];
  return sections.filter(
    (s): s is TailoredResumeSection =>
      !!s &&
      typeof s === "object" &&
      (s as TailoredResumeSection).id !== KIMCHI_META_SECTION_ID &&
      (s as TailoredResumeSection).type !== "meta",
  );
}

export function extractTailoredMeta(sections: unknown): TailoredResumeMeta | null {
  if (!Array.isArray(sections)) return null;
  const metaSec = sections.find(
    (s) =>
      s &&
      typeof s === "object" &&
      ((s as TailoredResumeSection).id === KIMCHI_META_SECTION_ID ||
        (s as TailoredResumeSection).type === "meta"),
  ) as TailoredResumeSection | undefined;
  if (!metaSec?.content) return null;
  try {
    return JSON.parse(metaSec.content) as TailoredResumeMeta;
  } catch {
    return null;
  }
}

export function attachTailoredMeta(
  sections: TailoredResumeSection[],
  meta: TailoredResumeMeta,
): TailoredResumeSection[] {
  const display = filterDisplaySections(sections);
  return [
    {
      id: KIMCHI_META_SECTION_ID,
      title: "",
      type: "meta",
      content: JSON.stringify(meta),
    },
    ...display,
  ];
}

export async function resolveResumeSource(
  userId: string,
  assetId: string | null | undefined,
): Promise<{ assetId: string | null; resumeText: string; skills: string[]; url: string | null }> {
  let asset = null;
  if (assetId?.trim()) {
    asset = await prisma.userAsset.findFirst({
      where: { id: assetId.trim(), userId, type: "RESUME" },
    });
  }
  if (!asset) {
    asset = await prisma.userAsset.findFirst({
      where: { userId, type: "RESUME", isPrimary: true },
    });
  }
  const parsed = normalizeParsedResumeData(asset?.parsedData);
  const skills = parsed?.skills ?? [];
  return {
    assetId: asset?.id ?? null,
    resumeText: asset?.resumeText?.trim() ?? "",
    skills,
    url: asset?.url ?? null,
  };
}

export async function buildTailoredSourceFingerprint(
  userId: string,
  assetId: string | null,
): Promise<string> {
  const source = await resolveResumeSource(userId, assetId);
  const textLen = source.resumeText.length;
  const textHead = source.resumeText.slice(0, 80);
  return `${source.assetId ?? "primary"}::${source.url ?? ""}::${textLen}::${textHead}`;
}

/** Full fingerprint including skills — used for role-gap analysis, not tailored stale checks. */
export async function buildSourceFingerprint(
  userId: string,
  assetId: string | null,
): Promise<string> {
  const source = await resolveResumeSource(userId, assetId);
  return buildResumeFingerprint(source.assetId, source.url, source.skills);
}

export async function isTailoredResumeStale(
  userId: string,
  sections: unknown,
): Promise<boolean> {
  const meta = extractTailoredMeta(sections);
  if (!meta?.sourceFingerprint) return false;
  const current = await buildTailoredSourceFingerprint(userId, meta.sourceAssetId);
  return current !== meta.sourceFingerprint;
}

/** Merge newly surfaced skills into the primary (master) resume asset + profile. */
export async function mergeSkillsIntoMasterResume(
  userId: string,
  newSkills: string[],
): Promise<string[]> {
  const normalized = [...new Set(newSkills.map((s) => s.trim()).filter(Boolean))];
  if (!normalized.length) return [];

  const primary = await prisma.userAsset.findFirst({
    where: { userId, type: "RESUME", isPrimary: true },
  });
  if (!primary) return [];

  const parsed = normalizeParsedResumeData(primary.parsedData) ?? {
    education: [],
    workExperience: [],
    skills: [],
    skillGroups: [],
    certifications: [],
  };
  const existing = new Set(parsed.skills.map((s) => s.toLowerCase()));
  const added = normalized.filter((s) => !existing.has(s.toLowerCase()));
  if (!added.length) return [];

  const nextSkills = [...parsed.skills, ...added];
  const nextParsed: ParsedResumeData = { ...parsed, skills: nextSkills };

  await prisma.userAsset.update({
    where: { id: primary.id },
    data: { parsedData: nextParsed as unknown as Prisma.InputJsonValue },
  });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (profile) {
    const profileParsed = normalizeParsedResumeData(profile.parsedData) ?? parsed;
    await prisma.profile.update({
      where: { userId },
      data: {
        parsedData: {
          ...profileParsed,
          skills: [...new Set([...(profileParsed.skills ?? []), ...added])],
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return added;
}
