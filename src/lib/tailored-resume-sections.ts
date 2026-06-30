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

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 48) return false;
  if (/^[-•*]\s/.test(t)) return false;
  if (/^[A-Z0-9\s&/.\-]+$/.test(t) && /[A-Z]/.test(t)) return true;
  return /^(professional summary|summary|experience|work experience|skills|education|certifications|projects|technical skills)$/i.test(t);
}

function titleFromHeader(line: string): string {
  const t = line.trim();
  return t
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Convert plain-text tailored resume into editor sections. */
export function plainTextToResumeSections(text: string): TailoredResumeSection[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  const sections: TailoredResumeSection[] = [];
  let i = 0;

  const headerLines: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      i++;
      if (headerLines.length) break;
      continue;
    }
    if (isSectionHeader(t) && headerLines.length > 0) break;
    headerLines.push(t);
    i++;
  }

  if (headerLines.length) {
    sections.push({
      id: "header",
      title: "Personal Info",
      type: "header",
      content: headerLines.join("\n"),
    });
  }

  while (i < lines.length) {
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) break;

    const header = lines[i].trim();
    if (!isSectionHeader(header)) {
      const orphan = lines.slice(i).map((l) => l.trim()).filter(Boolean);
      sections.push({
        id: `s-${sections.length}`,
        title: sections.length ? "Additional" : "Resume",
        type: "text",
        content: orphan.join("\n"),
      });
      break;
    }

    i++;
    const title = titleFromHeader(header);
    const contentLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (isSectionHeader(t)) break;
      if (t) contentLines.push(t.replace(/^[-•*]\s+/, ""));
      i++;
    }

    const bulletish =
      /experience|skills|projects|achievements|certifications/i.test(header) ||
      contentLines.length >= 2;
    sections.push({
      id: `s-${sections.length}`,
      title,
      type: bulletish ? "bullets" : "text",
      content: contentLines.join("\n"),
    });
  }

  if (!sections.length) {
    sections.push({ id: "body", title: "Resume", type: "text", content: trimmed });
  }

  return sections;
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
