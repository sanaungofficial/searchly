import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";
import type { ParsedResumeData } from "@/lib/resume-parse";

const DEFAULT_ACTOR = "dataweave/linkedin-profile-scraper";

type ApifyCertification = {
  name?: string;
  authority?: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  setLicenseNumber?: string;
};

type ApifyEducation = {
  schoolName?: string;
  degreeName?: string;
  fieldOfStudy?: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
};

type ApifyPosition = {
  companyName?: string;
  title?: string;
  description?: string;
  locationName?: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  current?: boolean;
};

type ApifySkill = { skillName?: string };

export type ApifyLinkedInProfile = {
  firstName?: string;
  lastName?: string;
  headline?: string;
  summary?: string;
  url?: string;
  publicIdentifier?: string;
  locationName?: string;
  picture?: string;
  educations?: ApifyEducation[];
  positions?: ApifyPosition[];
  skills?: ApifySkill[];
  certifications?: ApifyCertification[];
};

export function isApifyConfigured(): boolean {
  return !!process.env.APIFY_API_TOKEN?.trim();
}

function actorPath(): string {
  const raw = process.env.APIFY_LINKEDIN_ACTOR_ID?.trim() || DEFAULT_ACTOR;
  return raw.includes("~") ? raw : raw.replace("/", "~");
}

function formatYearMonth(year?: number, month?: number): string | null {
  if (!year) return null;
  if (month && month >= 1 && month <= 12) {
    return `${String(month).padStart(2, "0")}/${year}`;
  }
  return String(year);
}

function positionRange(pos: ApifyPosition): { from: string | null; to: string | null } {
  return {
    from: formatYearMonth(pos.startYear, pos.startMonth),
    to: pos.current ? "Present" : formatYearMonth(pos.endYear, pos.endMonth),
  };
}

export function mapApifyProfileToParsedData(raw: ApifyLinkedInProfile): ParsedResumeData {
  const name = [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim() || null;

  const workExperience = (raw.positions ?? []).map((pos, index) => {
    const { from, to } = positionRange(pos);
    return {
      id: `li_exp_${index}`,
      company: pos.companyName?.trim() || "Company",
      title: pos.title?.trim() || "Role",
      description: pos.description?.trim() || null,
      location: pos.locationName?.trim() || null,
      from,
      to,
      bullets: [],
    };
  });

  const education = (raw.educations ?? []).map((edu, index) => {
    const { from, to } = positionRange(edu);
    return {
      id: `li_edu_${index}`,
      school: edu.schoolName?.trim() || "School",
      degree: edu.degreeName?.trim() || "Degree",
      field: edu.fieldOfStudy?.trim() || null,
      from,
      to,
    };
  });

  const skills = (raw.skills ?? [])
    .map((s) => s.skillName?.trim())
    .filter(Boolean) as string[];

  const certifications = (raw.certifications ?? []).map((cert, index) => ({
    id: `li_cert_${index}`,
    name: cert.name?.trim() || "Certification",
    issuer: cert.authority?.trim() || null,
    date: formatYearMonth(cert.startYear, cert.startMonth),
  }));

  return {
    name,
    location: raw.locationName?.trim() || null,
    linkedinUrl: raw.url?.trim() || null,
    summary: raw.summary?.trim() || raw.headline?.trim() || null,
    education,
    workExperience,
    skills,
    skillGroups: skills.length ? [{ id: "li_skills", label: "Skills", skills }] : [],
    certifications,
  };
}

export function mapApifyProfileToLinkedInDraft(raw: ApifyLinkedInProfile): LinkedInProfileDraft {
  const parsed = mapApifyProfileToParsedData(raw);
  return {
    headline: raw.headline?.trim() || parsed.summary?.slice(0, 120) || "",
    about: raw.summary?.trim() || "",
    location: raw.locationName?.trim() || null,
    experience: parsed.workExperience.map((w) => ({
      id: w.id,
      title: w.title,
      company: w.company,
      companyRef: null,
      employmentType: "Full-time",
      location: w.location ?? null,
      from: w.from ?? null,
      to: w.to ?? null,
      description: w.description?.trim() || "",
      resumeSourceId: w.id,
    })),
    education: parsed.education.map((e) => ({
      id: e.id,
      school: e.school,
      degree: e.degree,
      field: e.field ?? null,
      from: e.from ?? null,
      to: e.to ?? null,
    })),
    skills: parsed.skills,
    featured: [],
    profilePhotoUrl: raw.picture?.trim() || null,
    coverPhotoUrl: null,
    generatedAt: new Date().toISOString(),
  };
}

export function buildResumeTextFromParsed(parsed: ParsedResumeData): string {
  const parts: string[] = [];
  if (parsed.name) parts.push(parsed.name);
  if (parsed.summary) parts.push(parsed.summary);
  for (const job of parsed.workExperience) {
    parts.push(`${job.title} at ${job.company}`);
    if (job.description) parts.push(job.description);
  }
  for (const edu of parsed.education) {
    parts.push(`${edu.degree} — ${edu.school}`);
  }
  if (parsed.skills.length) parts.push(`Skills: ${parsed.skills.join(", ")}`);
  return parts.join("\n\n").trim();
}

export async function scrapeLinkedInProfile(linkedinUrl: string): Promise<ApifyLinkedInProfile> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) throw new Error("APIFY_API_TOKEN is not configured.");

  const normalized = normalizeLinkedInUrl(linkedinUrl);
  if (!normalized) throw new Error("Invalid LinkedIn profile URL.");

  const timeoutSec = Math.min(Number(process.env.APIFY_LINKEDIN_TIMEOUT_SEC ?? 120), 300);
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorPath()}/run-sync-get-dataset-items?timeout=${timeoutSec}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        urls: [normalized],
        profileUrls: [normalized],
        startUrls: [{ url: normalized }],
      }),
      signal: AbortSignal.timeout((timeoutSec + 15) * 1000),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Apify request failed (${res.status})`);
  }

  const items = (await res.json()) as ApifyLinkedInProfile[];
  const raw = items?.[0];
  if (!raw) {
    throw new Error("LinkedIn profile could not be loaded — check the URL is public.");
  }
  const profile = normalizeApifyProfile(raw);
  if (!profile.publicIdentifier && !profile.firstName) {
    throw new Error("LinkedIn profile could not be loaded — check the URL is public.");
  }

  return profile;
}

function asApifyPositions(raw: ApifyLinkedInProfile & Record<string, unknown>): ApifyPosition[] {
  if (Array.isArray(raw.positions) && raw.positions.length) return raw.positions;
  const experience = raw.experience;
  if (!Array.isArray(experience)) return [];
  return experience.map((row) => {
    if (!row || typeof row !== "object") return {};
    const e = row as Record<string, unknown>;
    return {
      companyName: typeof e.companyName === "string" ? e.companyName : typeof e.company === "string" ? e.company : undefined,
      title: typeof e.title === "string" ? e.title : typeof e.position === "string" ? e.position : undefined,
      description: typeof e.description === "string" ? e.description : undefined,
      locationName: typeof e.locationName === "string" ? e.locationName : typeof e.location === "string" ? e.location : undefined,
      startYear: typeof e.startYear === "number" ? e.startYear : undefined,
      endYear: typeof e.endYear === "number" ? e.endYear : undefined,
      current: e.current === true,
    } satisfies ApifyPosition;
  });
}

function asApifyEducations(raw: ApifyLinkedInProfile & Record<string, unknown>): ApifyEducation[] {
  if (Array.isArray(raw.educations) && raw.educations.length) return raw.educations;
  const education = raw.education;
  if (!Array.isArray(education)) return [];
  return education.map((row) => {
    if (!row || typeof row !== "object") return {};
    const e = row as Record<string, unknown>;
    return {
      schoolName: typeof e.schoolName === "string" ? e.schoolName : typeof e.school === "string" ? e.school : undefined,
      degreeName: typeof e.degreeName === "string" ? e.degreeName : typeof e.degree === "string" ? e.degree : undefined,
      fieldOfStudy: typeof e.fieldOfStudy === "string" ? e.fieldOfStudy : undefined,
    } satisfies ApifyEducation;
  });
}

function normalizeApifyProfile(raw: ApifyLinkedInProfile): ApifyLinkedInProfile {
  const ext = raw as ApifyLinkedInProfile & Record<string, unknown>;
  let firstName = raw.firstName;
  let lastName = raw.lastName;
  if (!firstName && typeof ext.fullName === "string") {
    const parts = ext.fullName.trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(" ") || undefined;
  }
  return {
    ...raw,
    firstName,
    lastName,
    headline: raw.headline ?? (typeof ext.headline === "string" ? ext.headline : undefined),
    summary: raw.summary ?? (typeof ext.about === "string" ? ext.about : undefined),
    locationName: raw.locationName ?? (typeof ext.location === "string" ? ext.location : undefined),
    picture: raw.picture ?? (typeof ext.profilePicture === "string" ? ext.profilePicture : undefined),
    positions: asApifyPositions(ext),
    educations: asApifyEducations(ext),
    skills: Array.isArray(raw.skills)
      ? raw.skills
      : Array.isArray(ext.skills)
        ? ext.skills.map((s) => (typeof s === "string" ? { skillName: s } : (s as ApifySkill)))
        : [],
  };
}
