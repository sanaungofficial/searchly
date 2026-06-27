/** Best-effort LinkedIn people search URLs (no org ID required). */

export function buildLinkedInPeopleSearchUrl(params: {
  targetCompany: string;
  jobTitle?: string | null;
  pastCompanies?: string[];
  school?: string | null;
}): string {
  const company = params.targetCompany.trim();
  const parts: string[] = [company];

  if (params.pastCompanies?.length) {
    const past = params.pastCompanies
      .slice(0, 6)
      .map((c) => c.trim())
      .filter(Boolean);
    if (past.length === 1) {
      parts.push(`Previously at ${past[0]}`);
    } else if (past.length > 1) {
      parts.push(`Previously at ${past.slice(0, 3).join(" or ")}`);
    }
  }

  if (params.school?.trim()) {
    parts.push(params.school.trim());
  }

  if (params.jobTitle?.trim()) {
    parts.push(params.jobTitle.trim());
  }

  const keywords = parts.filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;
}

export function buildPastCompanyLinkedInUrl(targetCompany: string, pastCompanies: string[]): string {
  return buildLinkedInPeopleSearchUrl({ targetCompany, pastCompanies });
}

export function buildSchoolLinkedInUrl(targetCompany: string, school: string): string {
  return buildLinkedInPeopleSearchUrl({ targetCompany, school });
}

export function buildTeamLinkedInUrl(targetCompany: string, teamName: string | null, jobTitle: string): string {
  const keywords = [targetCompany, teamName, jobTitle].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;
}

export function buildDecisionMakerLinkedInUrl(targetCompany: string, jobTitle: string): string {
  const keywords = `${targetCompany} ${jobTitle} hiring manager`;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;
}
