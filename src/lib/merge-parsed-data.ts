import type { ParsedResumeData } from "@/lib/resume-parse";
import { hasResumeBodyContent } from "@/lib/resume-parse";

/** Prefer existing resume fields; fill gaps from LinkedIn import. */
export function mergeParsedResumeData(
  existing: ParsedResumeData | null,
  incoming: ParsedResumeData,
  options?: { preferIncoming?: boolean },
): ParsedResumeData {
  if (options?.preferIncoming || !existing) return incoming;
  if (!hasResumeBodyContent(existing)) {
    return {
      ...incoming,
      name: existing.name?.trim() || incoming.name || null,
      email: existing.email?.trim() || incoming.email || null,
      phone: existing.phone?.trim() || incoming.phone || null,
      location: existing.location?.trim() || incoming.location || null,
      linkedinUrl: existing.linkedinUrl?.trim() || incoming.linkedinUrl || null,
      website: existing.website?.trim() || incoming.website || null,
      hirebaseArtifactId: existing.hirebaseArtifactId ?? incoming.hirebaseArtifactId ?? null,
    };
  }

  const incomingRicher =
    incoming.workExperience.length > existing.workExperience.length ||
    incoming.skills.length > existing.skills.length;

  return {
    ...existing,
    name: existing.name?.trim() || incoming.name || null,
    email: existing.email?.trim() || incoming.email || null,
    phone: existing.phone?.trim() || incoming.phone || null,
    location: existing.location?.trim() || incoming.location || null,
    linkedinUrl: existing.linkedinUrl?.trim() || incoming.linkedinUrl || null,
    website: existing.website?.trim() || incoming.website || null,
    summary: existing.summary?.trim() || incoming.summary || null,
    workExperience:
      existing.workExperience.length > 0 && !incomingRicher
        ? existing.workExperience
        : incoming.workExperience.length >= existing.workExperience.length
          ? incoming.workExperience
          : existing.workExperience,
    education: existing.education.length ? existing.education : incoming.education,
    skills: existing.skills.length ? existing.skills : incoming.skills,
    skillGroups: existing.skillGroups.length ? existing.skillGroups : incoming.skillGroups,
    certifications: existing.certifications.length ? existing.certifications : incoming.certifications,
    hirebaseArtifactId: existing.hirebaseArtifactId ?? incoming.hirebaseArtifactId ?? null,
  };
}

/** LinkedIn import should refresh profile sections from scraped data. */
export function mergeLinkedInImportParsed(
  existing: ParsedResumeData | null,
  incoming: ParsedResumeData,
): ParsedResumeData {
  if (!existing) return incoming;
  return {
    ...existing,
    name: incoming.name?.trim() || existing.name || null,
    location: incoming.location?.trim() || existing.location || null,
    linkedinUrl: incoming.linkedinUrl?.trim() || existing.linkedinUrl || null,
    summary: incoming.summary?.trim() || existing.summary || null,
    workExperience: incoming.workExperience.length ? incoming.workExperience : existing.workExperience,
    education: incoming.education.length ? incoming.education : existing.education,
    skills: incoming.skills.length ? incoming.skills : existing.skills,
    skillGroups: incoming.skillGroups.length ? incoming.skillGroups : existing.skillGroups,
    certifications: incoming.certifications.length ? incoming.certifications : existing.certifications,
  };
}
