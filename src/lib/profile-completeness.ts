/** Shared profile completeness score (matches Profile workspace checklist). */

export type ProfileCompletenessInput = {
  name?: string | null;
  email?: string | null;
  resumeUrl?: string | null;
  linkedinUrl?: string | null;
  jobTimeline?: string | null;
  targetSalary?: string | null;
  priorities?: string[];
  parsedData?: {
    phone?: string | null;
    location?: string | null;
    education?: unknown[];
    workExperience?: unknown[];
    skills?: unknown[];
    tools?: unknown[];
  } | null;
};

export function profileCompletenessPct(p: ProfileCompletenessInput): number {
  let score = 0;
  if (p.name) score++;
  if (p.email) score++;
  if (p.parsedData?.phone) score++;
  if (p.parsedData?.location) score++;
  if (p.linkedinUrl) score++;
  if (p.resumeUrl) score += 2;
  if ((p.parsedData?.education || []).length > 0) score++;
  if ((p.parsedData?.workExperience || []).length > 0) score++;
  if ((p.parsedData?.skills || []).length > 0 || (p.parsedData?.tools || []).length > 0) score++;
  if (p.jobTimeline) score++;
  if (p.targetSalary) score++;
  if ((p.priorities || []).length > 0) score++;
  return Math.round((score / 13) * 100);
}
