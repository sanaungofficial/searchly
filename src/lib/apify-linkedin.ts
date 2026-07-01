import { formatApiErrorMessage } from "@/lib/api-error-message";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import { logApifyLinkedInRun } from "@/lib/external-api-usage";
import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";
import { emptyParsedResumeData, reconcileParsedSkillsTools, type ParsedResumeData } from "@/lib/resume-parse";
import { reconcileSkillsToolsFields, splitMatchablesByKind, syncSkillGroupsFromBuckets } from "@/lib/skills-tools";

/**
 * LinkedIn scrape via Apify.
 *
 * Env:
 * - APIFY_API_TOKEN — required for LinkedIn import
 * - APIFY_LINKEDIN_ACTOR_ID — optional; default `anchor/linkedin-profile-enrichment` (Apify id AgfKk0sQQxkpQJ1Dt)
 * - APIFY_LINKEDIN_TIMEOUT_SEC — optional sync run timeout (default 120, max 300)
 * - APIFY_USD_PER_LINKEDIN_RUN — optional cost estimate for admin usage stats (default 0.006)
 */
export const DEFAULT_LINKEDIN_ACTOR = "anchor/linkedin-profile-enrichment";
export const DEFAULT_LINKEDIN_ACTOR_ID = "AgfKk0sQQxkpQJ1Dt";

const DEFAULT_ACTOR = DEFAULT_LINKEDIN_ACTOR;

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
  backgroundCoverImageUrl?: string;
  educations?: ApifyEducation[];
  positions?: ApifyPosition[];
  skills?: ApifySkill[];
  certifications?: ApifyCertification[];
};

export function isApifyConfigured(): boolean {
  return !!process.env.APIFY_API_TOKEN?.trim();
}

export function getLinkedInActorSlug(): string {
  return process.env.APIFY_LINKEDIN_ACTOR_ID?.trim() || DEFAULT_ACTOR;
}

function actorPath(): string {
  const raw = getLinkedInActorSlug();
  return raw.includes("~") ? raw : raw.replace("/", "~");
}

export function formatApifyErrorBody(body: string, status: number): string {
  const trimmed = body.trim();
  if (!trimmed) return `Apify request failed (${status})`;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const errorObj = parsed.error as Record<string, unknown> | undefined;
    if (errorObj && typeof errorObj === "object") {
      const type = typeof errorObj.type === "string" ? errorObj.type : "";
      if (type === "full-permission-actor-not-approved") {
        const data = errorObj.data as Record<string, unknown> | undefined;
        const approvalUrl = typeof data?.approvalUrl === "string" ? data.approvalUrl.trim() : "";
        const actor = getLinkedInActorSlug();
        const base = `LinkedIn import needs Apify approval: approve the ${actor} actor in Apify Console, then retry import.`;
        return approvalUrl ? `${base} (${approvalUrl})` : base;
      }
      if (typeof errorObj.message === "string" && errorObj.message.trim()) {
        return errorObj.message.trim();
      }
    }
    return formatApiErrorMessage(parsed, `Apify request failed (${status})`);
  } catch {
    return trimmed;
  }
}

function formatYearMonth(year?: number, month?: number): string | null {
  if (!year) return null;
  if (month && month >= 1 && month <= 12) {
    return `${String(month).padStart(2, "0")}/${year}`;
  }
  return String(year);
}

const HARVEST_MONTH: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

type HarvestDate = { month?: string; year?: number; text?: string };

function parseHarvestDate(date?: HarvestDate): { year?: number; month?: number; present?: boolean } {
  if (!date) return {};
  if (date.text?.trim().toLowerCase() === "present") return { present: true };
  const month = date.month ? HARVEST_MONTH[date.month] : undefined;
  return { year: date.year, month, present: false };
}

function parseFlexibleDate(value: unknown): { year?: number; month?: number; present?: boolean } {
  if (value == null) return {};
  if (typeof value === "object") return parseHarvestDate(value as HarvestDate);
  if (typeof value === "number" && value >= 1900 && value <= 2100) return { year: value };
  if (typeof value !== "string") return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (trimmed.toLowerCase() === "present") return { present: true };
  const iso = trimmed.match(/^(\d{4})-(\d{2})/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]) };
  if (/^\d{4}$/.test(trimmed)) return { year: Number(trimmed) };
  const monthYear = trimmed.match(/([A-Za-z]{3})\s+(\d{4})/);
  if (monthYear?.[1] && monthYear[2]) {
    return { year: Number(monthYear[2]), month: HARVEST_MONTH[monthYear[1]] };
  }
  return {};
}

function buildLinkedInActorInput(linkedinUrl: string): Record<string, unknown> {
  return {
    startUrls: [{ url: linkedinUrl }],
    // Legacy fields for other actors when APIFY_LINKEDIN_ACTOR_ID overrides the default
    url: linkedinUrl,
    urls: [linkedinUrl],
    profileUrls: [linkedinUrl],
  };
}

function locationTextFromRaw(raw: Record<string, unknown>): string | undefined {
  const location = raw.location;
  if (typeof location === "string" && location.trim()) return location.trim();
  if (location && typeof location === "object") {
    const loc = location as Record<string, unknown>;
    if (typeof loc.linkedinText === "string" && loc.linkedinText.trim()) return loc.linkedinText.trim();
    const parsed = loc.parsed;
    if (parsed && typeof parsed === "object") {
      const text = (parsed as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim()) return text.trim();
    }
  }
  if (typeof raw.locationName === "string" && raw.locationName.trim()) return raw.locationName.trim();
  const city = typeof raw.city === "string" ? raw.city.trim() : "";
  const country = typeof raw.country === "string" ? raw.country.trim() : "";
  if (city || country) return [city, country].filter(Boolean).join(", ");
  return undefined;
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

  const linkedInSkills = (raw.skills ?? [])
    .map((s) => s.skillName?.trim())
    .filter(Boolean) as string[];
  const skillBuckets = splitMatchablesByKind(linkedInSkills);

  const certifications = (raw.certifications ?? []).map((cert, index) => ({
    id: `li_cert_${index}`,
    name: cert.name?.trim() || "Certification",
    issuer: cert.authority?.trim() || null,
    date: formatYearMonth(cert.startYear, cert.startMonth),
  }));

  return reconcileParsedSkillsTools({
    ...emptyParsedResumeData(),
    name,
    location: raw.locationName?.trim() || null,
    linkedinUrl: raw.url?.trim() || null,
    summary: raw.summary?.trim() || raw.headline?.trim() || null,
    education,
    workExperience,
    skills: skillBuckets.skills,
    tools: skillBuckets.tools,
    skillGroups: syncSkillGroupsFromBuckets(skillBuckets.skills, skillBuckets.tools),
    certifications,
  });
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
    coverPhotoUrl: raw.backgroundCoverImageUrl?.trim() || null,
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

export async function scrapeLinkedInProfile(
  linkedinUrl: string,
  ctx?: { userId?: string | null },
): Promise<ApifyLinkedInProfile> {
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
      body: JSON.stringify(buildLinkedInActorInput(normalized)),
      signal: AbortSignal.timeout((timeoutSec + 15) * 1000),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatApifyErrorBody(text, res.status));
  }

  const items = (await res.json()) as Array<ApifyLinkedInProfile & Record<string, unknown>>;
  const profile = unwrapApifyDatasetItem(items?.[0]);
  if (!profile.publicIdentifier && !profile.firstName && !profile.lastName) {
    throw new Error("LINKEDIN_EMPTY:We couldn't find that LinkedIn profile. Double-check the link is public.");
  }

  logApifyLinkedInRun(ctx?.userId);
  return profile;
}

function unwrapApifyDatasetItem(item: (ApifyLinkedInProfile & Record<string, unknown>) | undefined): ApifyLinkedInProfile {
  if (!item) {
    throw new Error("LINKEDIN_EMPTY:We couldn't find that LinkedIn profile. Double-check the link is public.");
  }

  const status = typeof item.status === "number" ? item.status : undefined;
  if (status && status >= 400) {
    const errObj = item.error;
    const message =
      (typeof item.message === "string" && item.message.trim()) ||
      (errObj && typeof errObj === "object" && typeof (errObj as Record<string, unknown>).message === "string"
        ? String((errObj as Record<string, unknown>).message).trim()
        : "") ||
      "LinkedIn profile scrape failed.";
    throw new Error(message);
  }

  if (item.element && typeof item.element === "object") {
    return normalizeApifyProfile(item.element as ApifyLinkedInProfile & Record<string, unknown>);
  }

  return normalizeApifyProfile(item);
}

function asApifyPositions(raw: ApifyLinkedInProfile & Record<string, unknown>): ApifyPosition[] {
  if (Array.isArray(raw.positions) && raw.positions.length) return raw.positions;
  const experience = raw.experiences ?? raw.experience;
  if (!Array.isArray(experience)) return [];
  return experience.map((row) => {
    if (!row || typeof row !== "object") return {};
    const e = row as Record<string, unknown>;
    const start = parseFlexibleDate(e.starts_at ?? e.startDate ?? e.start_date ?? e.start_year);
    const end = parseFlexibleDate(e.ends_at ?? e.endDate ?? e.end_date ?? e.end_year);
    const endText =
      typeof e.end_date === "string"
        ? e.end_date.trim().toLowerCase()
        : (e.endDate as HarvestDate | undefined)?.text?.trim().toLowerCase();
    const isCurrent = end.present === true || endText === "present" || e.current === true;
    return {
      companyName:
        typeof e.companyName === "string"
          ? e.companyName
          : typeof e.company === "string"
            ? e.company
            : undefined,
      title:
        typeof e.title === "string" ? e.title : typeof e.position === "string" ? e.position : undefined,
      description: typeof e.description === "string" ? e.description : undefined,
      locationName:
        typeof e.locationName === "string"
          ? e.locationName
          : typeof e.location === "string"
            ? e.location
            : undefined,
      startYear: start.year ?? (typeof e.startYear === "number" ? e.startYear : undefined),
      startMonth: start.month ?? (typeof e.startMonth === "number" ? e.startMonth : undefined),
      endYear: isCurrent ? undefined : end.year ?? (typeof e.endYear === "number" ? e.endYear : undefined),
      endMonth: isCurrent ? undefined : end.month ?? (typeof e.endMonth === "number" ? e.endMonth : undefined),
      current: isCurrent,
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
    const start = parseFlexibleDate(e.starts_at ?? e.startDate ?? e.start_date ?? e.start_year);
    const end = parseFlexibleDate(e.ends_at ?? e.endDate ?? e.end_date ?? e.end_year);
    return {
      schoolName:
        typeof e.schoolName === "string"
          ? e.schoolName
          : typeof e.school === "string"
            ? e.school
            : typeof e.title === "string"
              ? e.title
              : undefined,
      degreeName:
        typeof e.degreeName === "string" ? e.degreeName : typeof e.degree === "string" ? e.degree : undefined,
      fieldOfStudy:
        typeof e.fieldOfStudy === "string"
          ? e.fieldOfStudy
          : typeof e.field_of_study === "string"
            ? e.field_of_study
            : undefined,
      startYear: start.year ?? (typeof e.startYear === "number" ? e.startYear : undefined),
      startMonth: start.month ?? (typeof e.startMonth === "number" ? e.startMonth : undefined),
      endYear: end.year ?? (typeof e.endYear === "number" ? e.endYear : undefined),
      endMonth: end.month ?? (typeof e.endMonth === "number" ? e.endMonth : undefined),
    } satisfies ApifyEducation;
  });
}

function asApifyCertifications(raw: ApifyLinkedInProfile & Record<string, unknown>): ApifyCertification[] {
  const source = raw.certifications;
  if (!Array.isArray(source) || !source.length) return [];
  return source.map((row) => {
    if (!row || typeof row !== "object") return {};
    const c = row as Record<string, unknown>;
    const issued = parseIssuedAt(typeof c.issuedAt === "string" ? c.issuedAt : undefined);
    return {
      name: typeof c.name === "string" ? c.name : typeof c.title === "string" ? c.title : undefined,
      authority:
        typeof c.authority === "string" ? c.authority : typeof c.issuedBy === "string" ? c.issuedBy : undefined,
      startYear: issued.year ?? (typeof c.startYear === "number" ? c.startYear : undefined),
      startMonth: issued.month ?? (typeof c.startMonth === "number" ? c.startMonth : undefined),
      setLicenseNumber: typeof c.setLicenseNumber === "string" ? c.setLicenseNumber : undefined,
    } satisfies ApifyCertification;
  });
}

function parseIssuedAt(issuedAt?: string): { year?: number; month?: number } {
  if (!issuedAt?.trim()) return {};
  const match = issuedAt.trim().match(/([A-Za-z]{3})\s+(\d{4})/);
  if (!match?.[1] || !match[2]) return {};
  const month = HARVEST_MONTH[match[1]];
  const year = Number(match[2]);
  return { year: Number.isFinite(year) ? year : undefined, month };
}

function asApifySkills(raw: ApifyLinkedInProfile & Record<string, unknown>): ApifySkill[] {
  if (Array.isArray(raw.skills)) {
    return raw.skills.map((s) => {
      if (typeof s === "string") return { skillName: s };
      if (s && typeof s === "object") {
        const skill = s as Record<string, unknown>;
        const name =
          typeof skill.skillName === "string"
            ? skill.skillName
            : typeof skill.name === "string"
              ? skill.name
              : undefined;
        return { skillName: name };
      }
      return {};
    });
  }
  return [];
}

function normalizeApifyProfile(raw: ApifyLinkedInProfile & Record<string, unknown>): ApifyLinkedInProfile {
  let firstName =
    raw.firstName ?? (typeof raw.first_name === "string" ? raw.first_name.trim() : undefined);
  let lastName = raw.lastName ?? (typeof raw.last_name === "string" ? raw.last_name.trim() : undefined);
  const fullName =
    typeof raw.full_name === "string"
      ? raw.full_name.trim()
      : typeof raw.fullName === "string"
        ? raw.fullName.trim()
        : undefined;
  if (!firstName && fullName) {
    const parts = fullName.split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(" ") || undefined;
  }

  const publicIdentifier =
    raw.publicIdentifier ??
    (typeof raw.public_identifier === "string" ? raw.public_identifier.trim() : undefined);

  return {
    ...raw,
    firstName,
    lastName,
    publicIdentifier,
    headline: typeof raw.headline === "string" ? raw.headline : undefined,
    summary: raw.summary ?? (typeof raw.about === "string" ? raw.about : undefined),
    url:
      raw.url?.trim() ||
      (typeof raw.linkedinUrl === "string" ? raw.linkedinUrl.trim() : undefined) ||
      undefined,
    locationName: locationTextFromRaw(raw),
    picture:
      raw.picture?.trim() ||
      (typeof raw.profile_pic_url === "string" ? raw.profile_pic_url.trim() : undefined) ||
      (typeof raw.photo === "string" ? raw.photo.trim() : undefined) ||
      (typeof raw.profilePicture === "string" ? raw.profilePicture.trim() : undefined) ||
      (typeof raw.picture_url === "string" ? raw.picture_url.trim() : undefined) ||
      undefined,
    backgroundCoverImageUrl:
      raw.backgroundCoverImageUrl?.trim() ||
      (typeof raw.background_cover_image_url === "string"
        ? raw.background_cover_image_url.trim()
        : undefined) ||
      (typeof raw.backgroundCoverImage === "string" ? raw.backgroundCoverImage.trim() : undefined) ||
      (typeof raw.background_url === "string" ? raw.background_url.trim() : undefined) ||
      (typeof raw.banner === "string" ? raw.banner.trim() : undefined) ||
      undefined,
    positions: asApifyPositions(raw),
    educations: asApifyEducations(raw),
    skills: asApifySkills(raw),
    certifications: asApifyCertifications(raw),
  };
}
