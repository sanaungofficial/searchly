import type { ParsedResumeData } from "@/lib/resume-parse";

/** Prefer existing resume fields; fill gaps from LinkedIn import. */
export function mergeParsedResumeData(
  existing: ParsedResumeData | null,
  incoming: ParsedResumeData
): ParsedResumeData {
  const base = existing ?? incoming;
  if (!existing) return incoming;

  const hasResumeStructure =
    (existing.workExperience?.length ?? 0) > 0 ||
    (existing.education?.length ?? 0) > 0;

  return {
    ...base,
    name: existing.name?.trim() || incoming.name || null,
    location: existing.location?.trim() || incoming.location || null,
    linkedinUrl: existing.linkedinUrl?.trim() || incoming.linkedinUrl || null,
    summary: existing.summary?.trim() || incoming.summary || null,
    workExperience: hasResumeStructure ? existing.workExperience : incoming.workExperience,
    education: existing.education?.length ? existing.education : incoming.education,
    skills: existing.skills?.length ? existing.skills : incoming.skills,
    skillGroups: existing.skillGroups?.length ? existing.skillGroups : incoming.skillGroups,
    certifications: existing.certifications?.length ? existing.certifications : incoming.certifications,
  };
}
