/** Labels for in-network job cards/drawer — avoid Hirebase guessing wrong employers. */

const GENERIC_COMPANY_LABELS = new Set(
  [
    "recruiting firm",
    "recruiter network",
    "network",
    "confidential employer",
    "confidential company",
    "undisclosed",
    "undisclosed employer",
  ].map((s) => s.toLowerCase()),
);

const COMPANY_TYPE_LABELS = new Set(
  [
    "privately held",
    "public company",
    "non profit",
    "nonprofit",
    "non-profit",
    "educational institution",
    "government agency",
    "privately held, vc-backed",
    "privately held, private equity-backed",
  ].map((s) => s.toLowerCase()),
);

export function isGenericNetworkCompanyLabel(name: string | null | undefined): boolean {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return true;
  return GENERIC_COMPANY_LABELS.has(normalized) || COMPANY_TYPE_LABELS.has(normalized);
}

/** Hiring employer label for ExecThread listings (never Hirebase-guess). */
export function networkExecThreadEmployerLabel(job: {
  companyName?: string | null;
  companySummary?: string | null;
  industries?: string[];
}): string {
  const named = job.companyName?.trim();
  if (named && !isGenericNetworkCompanyLabel(named)) return named;

  return "Confidential employer";
}

/** Recruiting firm name when ExecThread provides one — null if unknown. */
export function networkExecThreadRecruitingFirmLabel(job: {
  agencyName?: string | null;
  recruiter?: { agencyName?: string | null } | null;
  recruiters?: Array<{ agencyName?: string | null }>;
}): string | null {
  const candidates = [
    job.agencyName,
    job.recruiter?.agencyName,
    ...(job.recruiters ?? []).map((r) => r.agencyName),
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed && !isGenericNetworkCompanyLabel(trimmed)) return trimmed;
  }

  return null;
}

/** Card / drawer employer line — TE uses agency; ET uses confidential employer copy. */
export function networkCardEmployerLabel(job: {
  source: "TOPECHELON" | "EXECTHREAD";
  companyName?: string | null;
  companySummary?: string | null;
  industries?: string[];
  agencyName?: string | null;
  networkId?: string | null;
  recruiter?: { agencyName?: string | null } | null;
}): string {
  if (job.source === "EXECTHREAD") {
    return networkExecThreadEmployerLabel(job);
  }

  const fromFields =
    job.agencyName?.trim() ||
    job.recruiter?.agencyName?.trim() ||
    job.companyName?.trim() ||
    null;
  if (fromFields && !isGenericNetworkCompanyLabel(fromFields)) return fromFields;

  const networkId = job.networkId?.trim();
  if (networkId) {
    const prefix = networkId.match(/^([A-Za-z]+\d*)/)?.[1];
    if (prefix) return prefix;
  }

  return "Recruiter network";
}
