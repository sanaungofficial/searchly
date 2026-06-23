import { prisma } from "@/lib/prisma";
import {
  fetchLinkedInProfileViaApify,
  isLinkedInApifyConfigured,
  type LinkedInApifyProfile,
} from "@/lib/linkedin-apify";
import { normalizeLinkedInUrl } from "@/lib/linkedin-url";
import {
  normalizeParsedResumeData,
  type ParsedResumeData,
  type ParsedWorkEntry,
  type ParsedEducationEntry,
} from "@/lib/resume-parse";
import { Prisma } from "@prisma/client";

export interface LinkedInScrapeResult {
  ok: boolean;
  linkedinUrl: string;
  headline?: string | null;
  mergedFields: string[];
  error?: string;
}

function toWorkEntries(
  rows: LinkedInApifyProfile["workExperience"],
): ParsedWorkEntry[] {
  return rows.map((row, index) => ({
    id: `li_exp_${index}`,
    company: row.company,
    title: row.title,
    description: row.description ?? null,
    from: row.from ?? null,
    to: row.to ?? null,
    bullets: row.description ? [row.description] : [],
  }));
}

function toEducationEntries(
  rows: LinkedInApifyProfile["education"],
): ParsedEducationEntry[] {
  return rows.map((row, index) => ({
    id: `li_edu_${index}`,
    school: row.school,
    degree: row.degree ?? "Degree",
    field: row.field ?? null,
    from: row.from ?? null,
    to: row.to ?? null,
  }));
}

function mergeParsedWithLinkedIn(
  existing: ParsedResumeData | null,
  scraped: LinkedInApifyProfile,
): { parsed: ParsedResumeData; mergedFields: string[] } {
  const base: ParsedResumeData = existing ?? {
    education: [],
    workExperience: [],
    skills: [],
    skillGroups: [],
    certifications: [],
  };

  const mergedFields: string[] = [];
  const parsed: ParsedResumeData = {
    ...base,
    education: [...base.education],
    workExperience: [...base.workExperience],
    skills: [...base.skills],
    skillGroups: [...base.skillGroups],
    certifications: [...base.certifications],
  };

  if (!parsed.linkedinUrl?.trim() && scraped.profileUrl) {
    parsed.linkedinUrl = normalizeLinkedInUrl(scraped.profileUrl);
    if (parsed.linkedinUrl) mergedFields.push("linkedinUrl");
  }

  if (!parsed.location?.trim() && scraped.location) {
    parsed.location = scraped.location;
    mergedFields.push("location");
  }

  if (!parsed.summary?.trim() && scraped.summary) {
    parsed.summary = scraped.summary;
    mergedFields.push("summary");
  }

  if (parsed.workExperience.length === 0 && scraped.workExperience.length > 0) {
    parsed.workExperience = toWorkEntries(scraped.workExperience);
    mergedFields.push("workExperience");
  }

  if (parsed.education.length === 0 && scraped.education.length > 0) {
    parsed.education = toEducationEntries(scraped.education);
    mergedFields.push("education");
  }

  if (parsed.skills.length === 0 && scraped.skills.length > 0) {
    parsed.skills = scraped.skills;
    mergedFields.push("skills");
  } else if (parsed.skills.length > 0 && scraped.skills.length > 0) {
    const seen = new Set(parsed.skills.map((s) => s.toLowerCase()));
    const added = scraped.skills.filter((skill) => {
      const key = skill.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (added.length > 0) {
      parsed.skills = [...parsed.skills, ...added];
      mergedFields.push("skills");
    }
  }

  return { parsed, mergedFields };
}

export async function scrapeAndMergeLinkedInProfile(
  userId: string,
  linkedinUrlInput: string,
): Promise<LinkedInScrapeResult> {
  const linkedinUrl = normalizeLinkedInUrl(linkedinUrlInput);
  if (!linkedinUrl) {
    return {
      ok: false,
      linkedinUrl: linkedinUrlInput,
      mergedFields: [],
      error: "Invalid LinkedIn profile URL",
    };
  }

  if (!isLinkedInApifyConfigured()) {
    return {
      ok: false,
      linkedinUrl,
      mergedFields: [],
      error: "LinkedIn scrape is not configured",
    };
  }

  const profile = await prisma.profile.findUnique({ where: { userId } });
  const existingParsed = normalizeParsedResumeData(profile?.parsedData ?? null);

  let scraped: LinkedInApifyProfile;
  try {
    scraped = await fetchLinkedInProfileViaApify(linkedinUrl);
  } catch (err) {
    return {
      ok: false,
      linkedinUrl,
      mergedFields: [],
      error: err instanceof Error ? err.message : "LinkedIn scrape failed",
    };
  }

  const { parsed, mergedFields } = mergeParsedWithLinkedIn(existingParsed, scraped);
  const headline = scraped.headline ?? profile?.headline ?? null;

  await prisma.profile.upsert({
    where: { userId },
    update: {
      linkedinUrl,
      headline: headline || profile?.headline || null,
      summary: parsed.summary ?? profile?.summary ?? null,
      parsedData: parsed as unknown as Prisma.InputJsonValue,
    },
    create: {
      userId,
      linkedinUrl,
      headline,
      summary: parsed.summary ?? undefined,
      parsedData: parsed as unknown as Prisma.InputJsonValue,
      targetRoles: [],
      priorities: [],
    },
  });

  if (scraped.fullName) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (!user?.name?.trim()) {
      await prisma.user.update({ where: { id: userId }, data: { name: scraped.fullName } });
    }
  }

  return {
    ok: true,
    linkedinUrl,
    headline,
    mergedFields,
  };
}
