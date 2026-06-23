export interface ParsedEducationEntry {
  id: string;
  school: string;
  degree: string;
  field?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface ParsedWorkEntry {
  id: string;
  company: string;
  title: string;
  description?: string | null;
  from?: string | null;
  to?: string | null;
  bullets: string[];
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
  skillGroups: ParsedSkillGroup[];
  certifications: ParsedCertificationEntry[];
  sectionOrder?: ResumeSectionId[];
  /** Hirebase `/v2/resumes/embed` artifact — use with `/v2/jobs/vsearch` search_type resume. */
  hirebaseArtifactId?: string | null;
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

function normalizeWorkExperience(raw: unknown): ParsedWorkEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
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
        from: asStringOrNull(row.from),
        to: asStringOrNull(row.to),
        bullets: asStringArray(row.bullets),
      };
    })
    .filter((entry): entry is ParsedWorkEntry => entry !== null);
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
  const skills = mergeSkills(
    obj.skills,
    obj.technicalSkills,
    obj.coreSkills,
    obj.keySkills,
  );
  const skillGroups = normalizeSkillGroups(obj.skillGroups ?? obj.skill_groups, skills);
  const certifications = normalizeCertifications(obj.certifications);
  const sectionOrder = normalizeSectionOrder(obj.sectionOrder);

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
    skills,
    skillGroups,
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
    skills.length > 0 ||
    skillGroups.length > 0 ||
    certifications.length > 0;

  return hasContent ? normalized : null;
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
    { label: "Skills", ok: data.skills.length > 0 || data.skillGroups.some((g) => g.skills.length > 0) },
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
): ParsedResumeData | null {
  const readbackSkills = skillsFromReadback(readbackData);
  if (!parsed) {
    if (!readbackSkills.length) return null;
    return { ...emptyParsedResumeData(), skills: readbackSkills, skillGroups: [{ id: "sg_0", label: "Skills", skills: readbackSkills }] };
  }
  if (parsed.skills.length || !readbackSkills.length) return parsed;
  return { ...parsed, skills: readbackSkills };
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
  { id: "skills", re: /^(?:areas\s+of\s+)?(?:emphasis|skills|core\s+competencies|technical\s+skills)\s*$/i },
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

function parseExperienceBlock(block: string): ParsedWorkEntry[] {
  const chunks = block.split(/\n(?=\S)/).map((c) => c.trim()).filter(Boolean);
  const entries: ParsedWorkEntry[] = [];
  let chunkIndex = 0;

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const dateLine = lines.find((l) => /\b(19|20)\d{2}\b/.test(l) && l.length < 40);
    const bulletLines = lines.filter((l) => /^[•\-\*–—]/.test(l) || /^\d+\.\s/.test(l));
    const contentLines = lines.filter((l) => l !== dateLine && !bulletLines.includes(l));

    if (contentLines.length >= 1) {
      entries.push({
        id: `exp_${chunkIndex++}`,
        title: contentLines[0] || "Role",
        company: contentLines[1] || "",
        from: dateLine?.match(/\b(19|20)\d{2}\b/)?.[0] || null,
        to: dateLine?.includes("Present") ? "Present" : null,
        bullets: bulletLines.map((b) => b.replace(/^[•\-\*–—]\s*/, "").replace(/^\d+\.\s*/, "")),
      });
    }
  }

  if (!entries.length && block.trim()) {
    entries.push({
      id: "exp_0",
      title: "Experience",
      company: "",
      bullets: block.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12),
    });
  }

  return entries;
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
  data.linkedinUrl = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0] ?? null;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerLine = lines.find((l) => !l.includes("@") && !/^https?:\/\//i.test(l) && l.length < 80);
  if (headerLine) data.name = headerLine;

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
    return entries.map((w) => `${w.title} ${w.company} ${w.bullets.join(" ")}`).join(" ");
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
