import {
  coalesceWorkExperience,
  emptyParsedResumeData,
  normalizeParsedResumeData,
  parsedResumeToText,
  type ParsedResumeData,
} from "@/lib/resume-parse";

const HIREBASE_BASE = "https://api.hirebase.org";
const MAX_BYTES = 5 * 1024 * 1024;

type HirebaseAddress = {
  street?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
};

type HirebasePersonalInfo = {
  full_name?: string;
  email?: string;
  phone_number?: string;
  address?: HirebaseAddress;
  links?: string[];
};

type HirebaseSkillCategory = {
  category?: string;
  details?: string[];
};

type HirebaseWorkEntry = {
  title?: string;
  company?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  responsibilities?: string[];
  achievements?: string[];
};

type HirebaseEducationEntry = {
  degree?: string;
  institution?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  GPA?: string;
  relevant_courses?: string[];
  thesis_or_project?: string;
};

type HirebaseCertification = string | { name?: string; title?: string; issuer?: string; date?: string };

type HirebaseResumePayload = {
  personal_information?: { data?: HirebasePersonalInfo };
  summary_or_objective?: string;
  skills?: HirebaseSkillCategory[];
  work_experience?: HirebaseWorkEntry[];
  education?: HirebaseEducationEntry[];
  certifications?: HirebaseCertification[];
};

type HirebaseEmbedResult = {
  embedding?: number[];
  dtype?: string;
  dim?: number;
  model_name?: string;
  model_version?: string;
  artifact_id?: string;
  id?: string;
};

type HirebaseEmbedResponse = {
  resume?: HirebaseResumePayload;
  result?: HirebaseEmbedResult;
  artifact_id?: string;
};

export type HirebaseResumeParseResult = {
  parsed: ParsedResumeData;
  resumeText: string;
  artifactId: string | null;
  provider: "hirebase";
};

function getApiKey(): string {
  const key = process.env.HIREBASE_API_KEY?.trim();
  if (!key) throw new Error("HIREBASE_API_KEY is not configured.");
  return key;
}

export function isHirebaseResumeConfigured(): boolean {
  return !!process.env.HIREBASE_API_KEY?.trim();
}

function mimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "html":
    case "htm":
      return "text/html";
    default:
      return "text/plain";
  }
}

function filenameForExt(ext: string): string {
  const safe = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  return `resume.${safe}`;
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function formatLocation(address?: HirebaseAddress, fallback?: string | null): string | null {
  if (fallback?.trim()) return fallback.trim();
  if (!address) return null;
  const parts = [address.street, address.city, address.state, address.zip_code, address.country]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Split "B.S. in Computer Science" → { degree, field }. */
function splitDegreeAndField(degreeRaw: string | null): { degree: string; field: string | null } {
  if (!degreeRaw) return { degree: "Degree", field: null };
  const inMatch = degreeRaw.match(/^(.+?)\s+in\s+(.+)$/i);
  if (inMatch) {
    return { degree: inMatch[1].trim(), field: inMatch[2].trim() || null };
  }
  return { degree: degreeRaw, field: null };
}

function educationField(entry: HirebaseEducationEntry, degreeRaw: string | null): string | null {
  const fromDegree = splitDegreeAndField(degreeRaw).field;
  if (fromDegree) return fromDegree;
  const thesis = asTrimmed(entry.thesis_or_project);
  if (thesis) return thesis;
  const courses = (entry.relevant_courses ?? []).map((c) => c.trim()).filter(Boolean);
  if (courses.length) return courses.slice(0, 4).join(", ");
  return null;
}

function pickLink(links: string[] | undefined, pattern: RegExp): string | null {
  if (!links?.length) return null;
  return links.find((link) => pattern.test(link)) ?? null;
}

function pickWebsite(links: string[] | undefined): string | null {
  if (!links?.length) return null;
  return links.find((link) => !/linkedin\.com/i.test(link)) ?? null;
}

function mapCertifications(raw: HirebaseCertification[] | undefined) {
  if (!raw?.length) return [];
  return raw
    .map((entry, index) => {
      if (typeof entry === "string") {
        const name = entry.trim();
        if (!name) return null;
        return { id: `cert_${index}`, name };
      }
      const name = asTrimmed(entry.name) || asTrimmed(entry.title);
      if (!name) return null;
      return {
        id: `cert_${index}`,
        name,
        issuer: asTrimmed(entry.issuer),
        date: asTrimmed(entry.date),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export function mapHirebaseResumeToParsedData(
  resume: HirebaseResumePayload,
  artifactId?: string | null,
): ParsedResumeData {
  const personal = resume.personal_information?.data;
  const links = personal?.links ?? [];

  const skillGroups = (resume.skills ?? [])
    .map((group, index) => {
      const skills = (group.details ?? []).map((s) => s.trim()).filter(Boolean);
      if (!skills.length) return null;
      return {
        id: `sg_${index}`,
        label: asTrimmed(group.category) || "Skills",
        skills,
      };
    })
    .filter((group): group is NonNullable<typeof group> => group !== null);

  const flatSkills = skillGroups.flatMap((group) => group.skills);

  const workExperience = coalesceWorkExperience(
    (resume.work_experience ?? [])
      .map((entry, index) => {
        const title = asTrimmed(entry.title);
        const company = asTrimmed(entry.company);
        if (!title && !company) return null;
        const bullets = [...(entry.responsibilities ?? []), ...(entry.achievements ?? [])]
          .map((line) => line.trim())
          .filter(Boolean);
        const jobLocation = asTrimmed(entry.location);
        return {
          id: `exp_${index}`,
          title: title || "Role",
          company: company || "Company",
          location: jobLocation,
          from: asTrimmed(entry.start_date),
          to: asTrimmed(entry.end_date),
          bullets,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  );

  const education = (resume.education ?? [])
    .map((entry, index) => {
      const school = asTrimmed(entry.institution);
      const degreeRaw = asTrimmed(entry.degree);
      if (!school && !degreeRaw) return null;
      const { degree } = splitDegreeAndField(degreeRaw);
      return {
        id: `edu_${index}`,
        school: school || asTrimmed(entry.location) || "School",
        degree,
        field: educationField(entry, degreeRaw),
        from: asTrimmed(entry.start_date),
        to: asTrimmed(entry.end_date),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const parsed: ParsedResumeData = {
    ...emptyParsedResumeData(),
    name: asTrimmed(personal?.full_name),
    email: asTrimmed(personal?.email),
    phone: asTrimmed(personal?.phone_number),
    location: formatLocation(personal?.address),
    website: pickWebsite(links),
    linkedinUrl: pickLink(links, /linkedin\.com/i),
    summary: asTrimmed(resume.summary_or_objective),
    skills: flatSkills,
    skillGroups,
    workExperience,
    education,
    certifications: mapCertifications(resume.certifications),
    hirebaseArtifactId: artifactId ?? null,
  };

  return normalizeParsedResumeData(parsed) ?? parsed;
}

function extractArtifactId(body: HirebaseEmbedResponse): string | null {
  return (
    asTrimmed(body.artifact_id) ||
    asTrimmed(body.result?.artifact_id) ||
    asTrimmed(body.result?.id)
  );
}

export async function parseResumeWithHirebase(input: {
  bytes: Buffer;
  ext: string;
  filename?: string;
}): Promise<HirebaseResumeParseResult | null> {
  if (!isHirebaseResumeConfigured()) return null;
  if (input.bytes.length > MAX_BYTES) {
    throw new Error("Resume file exceeds Hirebase 5 MB limit.");
  }

  const ext = input.ext.toLowerCase().replace(/^\./, "") || "pdf";
  const form = new FormData();
  const blob = new Blob([Uint8Array.from(input.bytes)], { type: mimeForExt(ext) });
  form.append("file", blob, input.filename || filenameForExt(ext));

  const res = await fetch(`${HIREBASE_BASE}/v2/resumes/embed`, {
    method: "POST",
    headers: { "x-api-key": getApiKey() },
    body: form,
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(formatHirebaseErrorBody(detail, res.status));
  }

  const body = (await res.json()) as HirebaseEmbedResponse;
  if (!body.resume) return null;

  const artifactId = extractArtifactId(body);
  const parsed = mapHirebaseResumeToParsedData(body.resume, artifactId);
  const resumeText = parsedResumeToText(parsed);

  return {
    parsed,
    resumeText: resumeText || "",
    artifactId,
    provider: "hirebase",
  };
}
