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
