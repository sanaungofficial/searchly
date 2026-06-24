/** Structured job fields stored in Job.notes JSON (JobMeta). */

export interface JobMeta {
  location?: string | null;
  salary?: string | null;
  jobType?: string | null;
  remote?: boolean | null;
  seniority?: string | null;
  experienceLevel?: string | null;
  description?: string | null;
  jobSummary?: string | null;
  companySummary?: string | null;
  responsibilities?: string[];
  skills?: string[];
  requiredQualifications?: string[];
  preferredQualifications?: string[];
  benefits?: string[];
  requirements?: string[];
  tags?: string[];
  nextStep?: string | null;
  nextStepDue?: string | null;
  /** Hirebase vector search match explanation (recommended jobs). */
  vectorMatch?: {
    matchScore: number;
    matchLabel: string;
    matchReasons: string[];
    matchedSkills?: string[];
    gapSkills?: string[];
    vectorRank?: number;
  };
  /** Top Echelon in-network job (admin / internal). */
  networkJob?: {
    externalId: string;
    networkId: string | null;
    topEchelonUrl: string | null;
    recruiterNotes: string | null;
    fee: string | null;
    networkStatus: string | null;
    adminDetails: Array<{ label: string; value: string }>;
    recruiter: {
      id: string;
      externalId: string;
      name: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
      agencyName: string | null;
    } | null;
  };
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function bool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  return null;
}

function arr(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const items = v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  return items.length ? items : undefined;
}

export function parsedJobToMeta(data: Record<string, unknown>): JobMeta {
  const skills = arr(data.skills) ?? arr(data.requirements) ?? [];
  return {
    location: str(data.location),
    salary: str(data.salary),
    jobType: str(data.jobType),
    remote: bool(data.remote),
    seniority: str(data.seniority),
    experienceLevel: str(data.experienceLevel),
    description: str(data.description),
    jobSummary: str(data.jobSummary),
    companySummary: str(data.companySummary),
    responsibilities: arr(data.responsibilities),
    skills,
    requiredQualifications: arr(data.requiredQualifications),
    preferredQualifications: arr(data.preferredQualifications),
    benefits: arr(data.benefits),
    requirements: skills,
    tags: arr(data.tags),
  };
}

/** Plain-text job posting for AI match, cover letter, and fit chat. */
export function resolveJobDescriptionText(
  meta: JobMeta | null | undefined,
  role?: string | null,
  company?: string | null,
): string {
  const full = meta?.description?.trim() ?? "";
  if (full.length >= 120) return full;

  const parts: string[] = [];
  if (role?.trim() && company?.trim()) parts.push(`${role.trim()} at ${company.trim()}`);
  else if (role?.trim()) parts.push(role.trim());
  if (meta?.jobSummary?.trim()) parts.push(meta.jobSummary.trim());
  if (meta?.location?.trim()) parts.push(`Location: ${meta.location.trim()}`);
  if (meta?.salary?.trim()) parts.push(`Salary: ${meta.salary.trim()}`);
  if (meta?.jobType?.trim()) parts.push(`Type: ${meta.jobType.trim()}`);
  if (meta?.seniority?.trim() || meta?.experienceLevel?.trim()) {
    parts.push(`Level: ${meta.seniority?.trim() || meta.experienceLevel?.trim()}`);
  }
  if (meta?.responsibilities?.length) {
    parts.push(`Responsibilities:\n${meta.responsibilities.map((r) => `• ${r}`).join("\n")}`);
  }
  if (meta?.requiredQualifications?.length) {
    parts.push(`Required:\n${meta.requiredQualifications.map((r) => `• ${r}`).join("\n")}`);
  }
  if (meta?.preferredQualifications?.length) {
    parts.push(`Preferred:\n${meta.preferredQualifications.map((r) => `• ${r}`).join("\n")}`);
  }
  if (meta?.skills?.length) parts.push(`Skills: ${meta.skills.join(", ")}`);
  if (meta?.benefits?.length) parts.push(`Benefits: ${meta.benefits.join(", ")}`);

  const built = parts.join("\n\n").trim();
  if (built.length >= 40) return built;
  return full;
}

export const PARSE_JOB_JSON_SHAPE = `{
  "company": "company name",
  "role": "job title",
  "location": "city, state, country, or Remote, or null",
  "salary": "e.g. $75/hr - $80/hr or $130K-$150K/yr or null",
  "jobType": "Full-time or Part-time or Contract or null",
  "remote": true or false or null,
  "seniority": "Entry Level or Mid Level or Senior Level or Director or VP or null",
  "jobSummary": "1-3 sentences describing the role (not the company)",
  "companySummary": "1-3 sentences about the hiring company",
  "description": "complete job posting as plain text for search",
  "responsibilities": ["responsibility bullet 1"],
  "skills": ["Email Marketing", "CRM Strategy"],
  "requiredQualifications": ["Email Marketing (advanced)"],
  "preferredQualifications": ["nice-to-have qualification"],
  "benefits": ["W2"],
  "tags": ["industry or department tag"]
}`;
