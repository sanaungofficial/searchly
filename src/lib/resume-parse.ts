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

export interface ParsedResumeData {
  name?: string | null;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  education: ParsedEducationEntry[];
  workExperience: ParsedWorkEntry[];
  skills: string[];
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
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
  const skills = asStringArray(obj.skills);

  const normalized: ParsedResumeData = {
    name: asStringOrNull(obj.name),
    phone: asStringOrNull(obj.phone),
    location: asStringOrNull(obj.location),
    website: asStringOrNull(obj.website),
    education,
    workExperience,
    skills,
  };

  const hasContent =
    !!normalized.name ||
    !!normalized.phone ||
    !!normalized.location ||
    !!normalized.website ||
    education.length > 0 ||
    workExperience.length > 0 ||
    skills.length > 0;

  return hasContent ? normalized : null;
}

export function hasParsedResumeSections(data: ParsedResumeData | null | undefined): boolean {
  if (!data) return false;
  return (
    !!data.phone ||
    !!data.location ||
    data.education.length > 0 ||
    data.workExperience.length > 0 ||
    data.skills.length > 0
  );
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
