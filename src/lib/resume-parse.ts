import { normalizeOrgRef, type LinkedInOrgRef } from "@/lib/linkedin-profile";
import { reconcileSkillsToolsFields } from "@/lib/skills-tools";

export interface ParsedEducationEntry {
  id: string;
  school: string;
  degree: string;
  field?: string | null;
  from?: string | null;
  to?: string | null;
  schoolRef?: LinkedInOrgRef | null;
}

export interface ParsedWorkEntry {
  id: string;
  company: string;
  title: string;
  description?: string | null;
  location?: string | null;
  from?: string | null;
  to?: string | null;
  bullets: string[];
  companyRef?: LinkedInOrgRef | null;
}

export interface ParsedSkillGroup {
  id: string;
  label: string;
  skills: string[];
}

export interface ParsedCertificationEntry {
  id: string;
  name: string;
  issuer?: string | null;
  date?: string | null;
}

export type ResumeSectionId = "summary" | "skills" | "experience" | "education" | "certifications";

export const DEFAULT_SECTION_ORDER: ResumeSectionId[] = [
  "summary",
  "skills",
  "experience",
  "education",
  "certifications",
];

export interface ParsedResumeData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  summary?: string | null;
  education: ParsedEducationEntry[];
  workExperience: ParsedWorkEntry[];
  skills: string[];
  tools: string[];
  skillGroups: ParsedSkillGroup[];
  certifications: ParsedCertificationEntry[];
  sectionOrder?: ResumeSectionId[];
  /** Hirebase `/v2/resumes/embed` artifact — use with `/v2/jobs/vsearch` search_type resume. */
  hirebaseArtifactId?: string | null;
  resumeStyle?: import("@/lib/resume-style").ResumeStyleSettings | null;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        return (
          asStringOrNull(row.name) ||
          asStringOrNull(row.skill) ||
          asStringOrNull(row.label) ||
          asStringOrNull(row.text) ||
          ""
        );
      }
      return "";
    })
    .filter(Boolean);
}

function mergeSkills(...groups: unknown[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const skill of asStringArray(group)) {
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(skill);
    }
  }
  return merged;
}

function normalizeEducation(raw: unknown): ParsedEducationEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const school = asStringOrNull(row.school);
      const degree = asStringOrNull(row.degree);
      if (!school && !degree) return null;
      return {
        id: asStringOrNull(row.id) || `edu_${index}`,
        school: school || "Unknown school",
        degree: degree || "Degree",
        field: asStringOrNull(row.field),
        from: asStringOrNull(row.from),
        to: asStringOrNull(row.to),
        schoolRef: normalizeOrgRef(row.schoolRef),
      };
    })
    .filter((entry): entry is ParsedEducationEntry => entry !== null);
}

function normalizeSkillGroups(raw: unknown, flatSkills: string[]): ParsedSkillGroup[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Record<string, unknown>;
        const label = asStringOrNull(row.label) || asStringOrNull(row.name) || "Skills";
        const skills = asStringArray(row.skills);
        if (!skills.length) return null;
        return {
          id: asStringOrNull(row.id) || `sg_${index}`,
          label,
          skills,
        };
      })
      .filter((entry): entry is ParsedSkillGroup => entry !== null);
  }
  if (flatSkills.length) {
    return [{ id: "sg_0", label: "Skills", skills: flatSkills }];
  }
  return [];
}

function normalizeCertifications(raw: unknown): ParsedCertificationEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const name = asStringOrNull(row.name) || asStringOrNull(row.title);
      if (!name) return null;
      return {
        id: asStringOrNull(row.id) || `cert_${index}`,
        name,
        issuer: asStringOrNull(row.issuer),
        date: asStringOrNull(row.date),
      };
    })
    .filter((entry): entry is ParsedCertificationEntry => entry !== null);
}

export function emptyParsedResumeData(): ParsedResumeData {
  return {
    education: [],
    workExperience: [],
    skills: [],
    tools: [],
    skillGroups: [],
    certifications: [],
    sectionOrder: [...DEFAULT_SECTION_ORDER],
  };
}

function normalizeSectionOrder(raw: unknown): ResumeSectionId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SECTION_ORDER];
  const allowed = new Set<ResumeSectionId>(DEFAULT_SECTION_ORDER);
  const ordered = raw.filter((id): id is ResumeSectionId => typeof id === "string" && allowed.has(id as ResumeSectionId));
  const missing = DEFAULT_SECTION_ORDER.filter((id) => !ordered.includes(id));
  return ordered.length ? [...ordered, ...missing] : [...DEFAULT_SECTION_ORDER];
}

function isPlaceholderCompany(company: string | null | undefined): boolean {
  if (!company?.trim()) return true;
  const normalized = company.trim().toLowerCase();
  return normalized === "unknown company" || normalized === "company";
}

/** True when an entry looks like a bullet that was split into its own job row. */
function looksLikeOrphanBullet(entry: ParsedWorkEntry): boolean {
  if (entry.bullets.length > 0) return false;
  if (entry.from?.trim() || entry.to?.trim()) return false;
  const title = entry.title.trim();
  if (title.length < 24) return false;
  if (title.includes("|")) return false;
  if (/\b(19|20)\d{2}\s*[–—-]\s*(Present|(19|20)\d{4})\b/i.test(title)) return false;
  return isPlaceholderCompany(entry.company);
}

const MONTH_YEAR =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\s+\\d{4}|\\d{4}";
const DATE_RANGE_RE = new RegExp(
  `\\b(${MONTH_YEAR})\\s*[–—-]\\s*((${MONTH_YEAR})|Present)\\b`,
  "i",
);

/** Split "Company | Title  2025 – Present" into structured fields. */
export function parseJobHeaderLine(line: string): {
  company: string;
  title: string;
  from: string | null;
  to: string | null;
} {
  const trimmed = line.trim();
  const dateMatch = trimmed.match(DATE_RANGE_RE);
  let from: string | null = dateMatch?.[1] ?? null;
  let to: string | null = dateMatch?.[3] ?? dateMatch?.[2] ?? null;
  if (to && /^present$/i.test(to)) to = "Present";

  let headerPart = trimmed;
  if (dateMatch?.index != null) {
    headerPart = trimmed.slice(0, dateMatch.index).trim().replace(/[\s|–—-]+$/g, "");
  }

  if (headerPart.includes("|")) {
    const parts = headerPart.split("|").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { company: parts[0], title: parts.slice(1).join(" | "), from, to };
    }
  }

  const emDash = headerPart.match(/^(.+?)\s*[—–]\s*(.+?)(?:\s*\(|$)/);
  if (emDash) {
    return { company: emDash[1].trim(), title: emDash[2].trim(), from, to };
  }

  return { company: "", title: headerPart, from, to };
}

/** Merge bullet-only rows into the previous job; split combined header lines. */
export function coalesceWorkExperience(entries: ParsedWorkEntry[]): ParsedWorkEntry[] {
  const merged: ParsedWorkEntry[] = [];

  for (const entry of entries) {
    if (looksLikeOrphanBullet(entry) && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.bullets = [...prev.bullets, entry.title.trim()];
      continue;
    }

    let next = { ...entry };
    if (next.title.includes("|") && isPlaceholderCompany(next.company)) {
      const parsed = parseJobHeaderLine(next.title);
      if (parsed.company) {
        next = {
          ...next,
          company: parsed.company,
          title: parsed.title || next.title,
          from: next.from || parsed.from,
          to: next.to || parsed.to,
        };
      }
    }

    merged.push(next);
  }

  return merged;
}

/** Detect parses where most experience rows are mis-split bullet lines. */
export function isLikelyBrokenWorkExperience(entries: ParsedWorkEntry[]): boolean {
  if (entries.length < 4) return false;
  const orphans = entries.filter(looksLikeOrphanBullet);
  return orphans.length >= Math.max(3, Math.ceil(entries.length * 0.35));
}

function normalizeWorkExperience(raw: unknown): ParsedWorkEntry[] {
  if (!Array.isArray(raw)) return [];
  const normalized = raw
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const company = asStringOrNull(row.company);
      const title = asStringOrNull(row.title);
      if (!company && !title) return null;
      return {
        id: asStringOrNull(row.id) || `exp_${index}`,
        company: company || "Unknown company",
        title: title || "Role",
        description: asStringOrNull(row.description),
        location: asStringOrNull(row.location),
        from: asStringOrNull(row.from),
        to: asStringOrNull(row.to),
        bullets: asStringArray(row.bullets),
        companyRef: normalizeOrgRef(row.companyRef),
      };
    })
    .filter((entry): entry is ParsedWorkEntry => entry !== null);

  return coalesceWorkExperience(normalized);
}

export function parseJsonFromModel(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* fall through */
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
}

export function normalizeParsedResumeData(raw: unknown): ParsedResumeData | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const education = normalizeEducation(obj.education ?? obj.educations);
  const workExperience = normalizeWorkExperience(
    obj.workExperience ?? obj.work_experience ?? obj.experience ?? obj.experiences,
  );
  const skills = mergeSkills(obj.skills, obj.coreSkills, obj.keySkills);
  const tools = mergeSkills(obj.tools, obj.technologies, obj.techStack, obj.technicalSkills);
  const skillGroups = normalizeSkillGroups(obj.skillGroups ?? obj.skill_groups, mergeSkills(skills, tools));
  const certifications = normalizeCertifications(obj.certifications);
  const sectionOrder = normalizeSectionOrder(obj.sectionOrder);

  const reconciled = reconcileSkillsToolsFields({ skills, tools, skillGroups });

  const normalized: ParsedResumeData = {
    name: asStringOrNull(obj.name),
    email: asStringOrNull(obj.email),
    phone: asStringOrNull(obj.phone),
    location: asStringOrNull(obj.location),
    website: asStringOrNull(obj.website),
    linkedinUrl: asStringOrNull(obj.linkedinUrl ?? obj.linkedin),
    summary: asStringOrNull(obj.summary),
    education,
    workExperience,
    skills: reconciled.skills,
    tools: reconciled.tools,
    skillGroups: reconciled.skillGroups,
    certifications,
    sectionOrder,
    hirebaseArtifactId: asStringOrNull(obj.hirebaseArtifactId ?? obj.hirebase_artifact_id),
  };

  const hasContent =
    !!normalized.name ||
    !!normalized.email ||
    !!normalized.phone ||
    !!normalized.location ||
    !!normalized.website ||
    !!normalized.linkedinUrl ||
    !!normalized.summary ||
    education.length > 0 ||
    workExperience.length > 0 ||
    normalized.skills.length > 0 ||
    normalized.tools.length > 0 ||
    normalized.skillGroups.length > 0 ||
    certifications.length > 0;

  return hasContent ? normalized : null;
}

export function reconcileParsedSkillsTools(data: ParsedResumeData): ParsedResumeData {
  const reconciled = reconcileSkillsToolsFields(data);
  return { ...data, ...reconciled };
}

export function hasParsedResumeSections(data: ParsedResumeData | null | undefined): boolean {
  if (!data) return false;
  return (
    !!data.name ||
    !!data.email ||
    !!data.phone ||
    !!data.location ||
    !!data.summary ||
    data.education.length > 0 ||
    data.workExperience.length > 0 ||
    data.skills.length > 0 ||
    data.skillGroups.length > 0 ||
    data.certifications.length > 0
  );
}

/** True when experience, education, skills, or summary exist — not just contact/header. */
export function hasResumeBodyContent(data: ParsedResumeData | null | undefined): boolean {
  if (!data) return false;
  return (
    !!data.summary?.trim() ||
    data.workExperience.length > 0 ||
    data.education.length > 0 ||
    data.skills.length > 0 ||
    data.tools.length > 0 ||
    data.skillGroups.some((g) => g.skills.length > 0) ||
    data.certifications.length > 0
  );
}

export function resumeCompleteness(data: ParsedResumeData): { pct: number; missing: string[] } {
  const checks: { label: string; ok: boolean }[] = [
    { label: "Name", ok: !!data.name?.trim() },
    { label: "Contact", ok: !!(data.email?.trim() || data.phone?.trim()) },
    { label: "Location", ok: !!data.location?.trim() },
    { label: "Summary", ok: !!data.summary?.trim() },
    { label: "Experience", ok: data.workExperience.length > 0 },
    { label: "Education", ok: data.education.length > 0 },
    { label: "Skills", ok: data.skills.length > 0 || data.tools.length > 0 || data.skillGroups.some((g) => g.skills.length > 0) },
  ];
  const done = checks.filter((c) => c.ok).length;
  return {
    pct: Math.round((done / checks.length) * 100),
    missing: checks.filter((c) => !c.ok).map((c) => c.label),
  };
}

export function skillsFromReadback(readbackData: unknown): string[] {
  if (!readbackData || typeof readbackData !== "object") return [];
  const strengths = (readbackData as Record<string, unknown>).strengths;
  return asStringArray(strengths);
}

export function mergeParsedWithReadback(
  parsed: ParsedResumeData | null,
  readbackData: unknown,
): ParsedResumeData {
  const readbackSkills = skillsFromReadback(readbackData);
  if (!parsed) {
    if (!readbackSkills.length) return emptyParsedResumeData();
    return {
      ...emptyParsedResumeData(),
      skills: readbackSkills,
      skillGroups: [{ id: "sg_0", label: "Skills", skills: readbackSkills }],
    };
  }
  if (parsed.skills.length || parsed.tools.length || !readbackSkills.length) return parsed;
  return { ...parsed, skills: readbackSkills, skillGroups: [{ id: "sg_0", label: "Skills", skills: readbackSkills }] };
}

export function shouldReplaceNameWithResumeName(
  currentName: string | null | undefined,
  email: string,
  metadataName?: string | null,
): boolean {
  if (!currentName?.trim()) return true;
  const emailPrefix = email.split("@")[0]?.toLowerCase();
  const normalized = currentName.trim().toLowerCase();
  if (emailPrefix && normalized === emailPrefix) return true;
  if (metadataName && normalized === metadataName.trim().toLowerCase()) return true;
  return false;
}

const SECTION_MARKERS: { id: ResumeSectionId; re: RegExp }[] = [
  { id: "summary", re: /^(?:professional\s+)?summary(?:\s+of\s+qualifications)?\s*$/i },
  { id: "skills", re: /^(?:areas\s+of\s+)?(?:emphasis|skills|core\s+competencies)\s*$/i },
  { id: "skills", re: /^(?:technical\s+skills|tools?(?:\s*&\s*technologies)?|tech\s+stack)\s*$/i },
  { id: "experience", re: /^(?:professional\s+)?(?:work\s+)?experience\s*$/i },
  { id: "education", re: /^education(?:\s*(?:&|and)\s*training)?\s*$/i },
  { id: "certifications", re: /^certifications?\s*$/i },
];

function splitResumeSections(text: string): Partial<Record<ResumeSectionId, string>> {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Partial<Record<ResumeSectionId, string[]>> = {};
  let current: ResumeSectionId | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) (sections[current] ||= []).push("");
      continue;
    }
    const marker = SECTION_MARKERS.find((m) => m.re.test(trimmed));
    if (marker) {
      current = marker.id;
      sections[current] ||= [];
      continue;
    }
    if (current) (sections[current] ||= []).push(trimmed);
  }

  const out: Partial<Record<ResumeSectionId, string>> = {};
  for (const [key, value] of Object.entries(sections)) {
    out[key as ResumeSectionId] = value.join("\n").trim();
  }
  return out;
}

function isJobHeaderLine(line: string): boolean {
  if (/^earlier experience/i.test(line)) return false;
  if (line.includes("|") && line.length < 180) return true;
  if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s*[–—-]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}|\d{4}|Present)\b/i.test(line)) {
    return !/^(Led|Managed|Drove|Owned|Directed|Spearheaded|Architected|Established|Improved|Delivered|Oversaw|Built|Designed|Developed|Implemented|Introduced|Administered|Hired|Simplified|Inherited|Recruited|Migrated)\b/i.test(line);
  }
  if (/\b(19|20)\d{2}\s*[–—-]\s*(Present|(19|20)\d{4})\b/i.test(line) && line.length < 200) {
    return !/^(Led|Managed|Drove|Owned|Directed|Spearheaded|Architected|Established|Improved|Delivered|Oversaw|Built|Designed|Developed|Implemented|Introduced|Administered|Hired|Simplified|Inherited|Recruited|Migrated)\b/i.test(line);
  }
  return false;
}

function parseExperienceBlock(block: string): ParsedWorkEntry[] {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const entries: ParsedWorkEntry[] = [];
  let current: ParsedWorkEntry | null = null;
  let index = 0;

  const pushCurrent = () => {
    if (current && (current.title.trim() || current.company.trim())) {
      entries.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    if (/^earlier experience/i.test(line)) continue;

    const isBullet = /^[•\-\*–—]/.test(line) || /^\d+\.\s/.test(line);
    const bulletText = line.replace(/^[•\-\*–—]\s*/, "").replace(/^\d+\.\s*/, "");

    if (!isBullet && isJobHeaderLine(line)) {
      pushCurrent();
      const parsed = parseJobHeaderLine(line);
      const inlineBullet = line.match(/:\s+(.+)$/);
      current = {
        id: `exp_${index++}`,
        company: parsed.company,
        title: parsed.title.replace(/:\s+.+$/, "").trim(),
        from: parsed.from,
        to: parsed.to,
        bullets: inlineBullet?.[1] ? [inlineBullet[1].trim()] : [],
      };
      continue;
    }

    if (current) {
      current.bullets.push(isBullet ? bulletText : line);
      continue;
    }

    if (!isBullet) {
      const parsed = parseJobHeaderLine(line);
      current = {
        id: `exp_${index++}`,
        company: parsed.company,
        title: parsed.title,
        from: parsed.from,
        to: parsed.to,
        bullets: [],
      };
    }
  }

  pushCurrent();

  if (!entries.length && block.trim()) {
    entries.push({
      id: "exp_0",
      title: "Experience",
      company: "",
      bullets: block.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12),
    });
  }

  return coalesceWorkExperience(
    entries.map((entry) => ({
      ...entry,
      company: entry.company || "Unknown company",
    })),
  );
}

function parseEducationBlock(block: string): ParsedEducationEntry[] {
  return block
    .split(/\n(?=\S)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, i) => {
      const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
      return {
        id: `edu_${i}`,
        degree: lines[0] || "Degree",
        school: lines[1] || lines[0] || "School",
      };
    });
}

function parseSkillsBlock(block: string): { skills: string[]; groups: ParsedSkillGroup[] } {
  const skills = block
    .split(/[,;|\n•\-\*–—]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 60);
  if (!skills.length) return { skills: [], groups: [] };
  return {
    skills,
    groups: [{ id: "sg_0", label: "Skills", skills }],
  };
}

/** Best-effort structure when AI is unavailable or returns empty sections. */
export function fallbackParseResumeFromText(rawText: string): ParsedResumeData {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  const data = emptyParsedResumeData();
  if (!text) return data;

  data.email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  data.phone = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] ?? null;
  const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,]+/i)?.[0] ?? null;
  data.linkedinUrl = linkedinMatch
    ? (linkedinMatch.startsWith("http") ? linkedinMatch : `https://${linkedinMatch}`)
    : null;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerLine = lines.find(
    (line) =>
      !line.includes("@") &&
      !/^https?:\/\//i.test(line) &&
      !/^(professional summary|core competencies|technical skills|professional experience|education|earlier experience)/i.test(line) &&
      line.length < 80,
  );
  if (headerLine) data.name = headerLine;

  const contactLine = lines.find((line) => line.includes("@") || /linkedin\.com/i.test(line));
  if (contactLine) {
    const locationMatch = contactLine.match(
      /([A-Z][A-Za-z .'-]+,\s*[A-Z]{2})(?:\s*\(|(?:\s*\|\s*|\s+)(?:\+?1|\(?\d{3}\)|\d{3}[-.\s]\d{3}|[a-z0-9._%+-]+@))/,
    );
    if (locationMatch) data.location = locationMatch[1].trim();
  }

  const sections = splitResumeSections(text);

  if (sections.summary) data.summary = sections.summary;
  if (sections.experience) data.workExperience = parseExperienceBlock(sections.experience);
  if (sections.education) data.education = parseEducationBlock(sections.education);
  if (sections.skills) {
    const { skills, groups } = parseSkillsBlock(sections.skills);
    data.skills = skills;
    data.skillGroups = groups;
  }
  if (sections.certifications) {
    data.certifications = sections.certifications
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((name, i) => ({ id: `cert_${i}`, name }));
  }

  if (!hasResumeBodyContent(data)) {
    const withoutHeader = lines.slice(lines.indexOf(headerLine || "") + 1).join("\n").trim();
    data.summary = (sections.summary || withoutHeader || text).slice(0, 8000);
  }

  return data;
}

export function sectionTextBlob(data: ParsedResumeData, sectionId: ResumeSectionId, entryId?: string): string {
  if (sectionId === "summary") return data.summary || "";
  if (sectionId === "skills") {
    const groups = data.skillGroups.length
      ? data.skillGroups
      : data.skills.length
        ? [{ id: "skills_0", label: "Skills", skills: data.skills }]
        : [];
    return groups.map((g) => `${g.label} ${g.skills.join(" ")}`).join(" ");
  }
  if (sectionId === "experience") {
    const entries = entryId ? data.workExperience.filter((w) => w.id === entryId) : data.workExperience;
    return entries.map((w) => `${w.title} ${w.company} ${w.location ?? ""} ${w.bullets.join(" ")}`).join(" ");
  }
  if (sectionId === "education") {
    return data.education.map((e) => `${e.degree} ${e.school}`).join(" ");
  }
  return data.certifications.map((c) => c.name).join(" ");
}

export function parsedResumeToText(data: ParsedResumeData): string {
  const parts = [
    data.name,
    data.email,
    data.phone,
    data.location,
    data.linkedinUrl,
    data.website,
    data.summary,
    sectionTextBlob(data, "skills"),
    sectionTextBlob(data, "experience"),
    sectionTextBlob(data, "education"),
    sectionTextBlob(data, "certifications"),
  ];
  return parts.filter(Boolean).join("\n");
}
