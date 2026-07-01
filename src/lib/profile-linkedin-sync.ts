import {
  bulletsToParagraphs,
  buildLinkedInDraftHeuristic,
  newLinkedInEntryId,
  normalizeLinkedInDraft,
  type LinkedInEducationEntry,
  type LinkedInExperienceEntry,
  type LinkedInOrgRef,
  type LinkedInProfileDraft,
} from "@/lib/linkedin-profile";
import {
  emptyParsedResumeData,
  normalizeParsedResumeData,
  type ParsedEducationEntry,
  type ParsedResumeData,
  type ParsedWorkEntry,
} from "@/lib/resume-parse";
import { addMatchableToBuckets, reconcileSkillsToolsFields } from "@/lib/skills-tools";

/** LinkedIn shows a trimmed skill list; About keeps the full set. */
export const LINKEDIN_SKILLS_DISPLAY_MAX = 20;

function normKey(value: string): string {
  return value.trim().toLowerCase();
}

function paragraphsToBullets(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/\n\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function orgRefMapFromDraft(draft: LinkedInProfileDraft | null | undefined): {
  companies: Map<string, LinkedInOrgRef>;
  schools: Map<string, LinkedInOrgRef>;
} {
  const companies = new Map<string, LinkedInOrgRef>();
  const schools = new Map<string, LinkedInOrgRef>();
  for (const exp of draft?.experience ?? []) {
    if (exp.companyRef?.name) companies.set(normKey(exp.companyRef.name), exp.companyRef);
    else if (exp.company && exp.companyRef) companies.set(normKey(exp.company), exp.companyRef);
  }
  for (const edu of draft?.education ?? []) {
    if (edu.schoolRef?.name) schools.set(normKey(edu.schoolRef.name), edu.schoolRef);
    else if (edu.school && edu.schoolRef) schools.set(normKey(edu.school), edu.schoolRef);
  }
  return { companies, schools };
}

function findExistingExperience(
  existing: LinkedInProfileDraft | null | undefined,
  work: ParsedWorkEntry,
): LinkedInExperienceEntry | undefined {
  if (!existing) return undefined;
  return existing.experience.find(
    (exp) =>
      exp.resumeSourceId === work.id ||
      exp.id === work.id ||
      (normKey(exp.company) === normKey(work.company) && normKey(exp.title) === normKey(work.title)),
  );
}

function findExistingEducation(
  existing: LinkedInProfileDraft | null | undefined,
  edu: ParsedEducationEntry,
): LinkedInEducationEntry | undefined {
  if (!existing) return undefined;
  return existing.education.find(
    (row) =>
      row.id === edu.id ||
      (normKey(row.school) === normKey(edu.school) && normKey(row.degree) === normKey(edu.degree)),
  );
}

function resolveCompanyRef(
  work: ParsedWorkEntry,
  companyMap: Map<string, LinkedInOrgRef>,
  existing?: LinkedInExperienceEntry,
): LinkedInOrgRef | null {
  return work.companyRef ?? companyMap.get(normKey(work.company)) ?? existing?.companyRef ?? null;
}

function resolveSchoolRef(
  edu: ParsedEducationEntry,
  schoolMap: Map<string, LinkedInOrgRef>,
  existing?: LinkedInEducationEntry,
): LinkedInOrgRef | null {
  return edu.schoolRef ?? schoolMap.get(normKey(edu.school)) ?? existing?.schoolRef ?? null;
}

/** Build a LinkedIn draft view from About (`parsedData`) — About is source of truth. */
export function syncLinkedInDraftFromAbout(input: {
  parsed: ParsedResumeData;
  name: string;
  targetRoles: string[];
  headline?: string | null;
  summary?: string | null;
  existingDraft?: LinkedInProfileDraft | null;
  sourceAssetId?: string | null;
}): LinkedInProfileDraft {
  const { parsed, name, targetRoles, headline, summary, existingDraft, sourceAssetId } = input;
  const heuristic = buildLinkedInDraftHeuristic({
    resume: parsed,
    name,
    targetRoles,
    sourceAssetId,
  });
  const { companies, schools } = orgRefMapFromDraft(existingDraft);

  const experience: LinkedInExperienceEntry[] = parsed.workExperience.map((work, index) => {
    const existing = findExistingExperience(existingDraft, work);
    const companyRef = resolveCompanyRef(work, companies, existing);
    return {
      id: existing?.id ?? work.id ?? newLinkedInEntryId("li_exp"),
      title: work.title,
      company: companyRef?.name || work.company,
      companyRef,
      employmentType: existing?.employmentType ?? "Full-time",
      location: work.location ?? existing?.location ?? null,
      from: work.from ?? null,
      to: work.to ?? null,
      description:
        work.description?.trim() ||
        bulletsToParagraphs(work.bullets) ||
        existing?.description ||
        "",
      resumeSourceId: work.id,
    };
  });

  const education: LinkedInEducationEntry[] = parsed.education.map((edu, index) => {
    const existing = findExistingEducation(existingDraft, edu);
    const schoolRef = resolveSchoolRef(edu, schools, existing);
    const degreeLabel = edu.field ? `${edu.degree}, ${edu.field}` : edu.degree;
    return {
      id: existing?.id ?? edu.id ?? newLinkedInEntryId("li_edu"),
      school: schoolRef?.name || edu.school,
      schoolRef,
      degree: degreeLabel,
      field: edu.field ?? null,
      from: edu.from ?? null,
      to: edu.to ?? null,
    };
  });

  const aboutText = summary?.trim() || parsed.summary?.trim() || existingDraft?.about?.trim() || heuristic.about;

  return normalizeLinkedInDraft({
    headline: headline?.trim() || existingDraft?.headline?.trim() || heuristic.headline,
    about: aboutText,
    location: parsed.location ?? existingDraft?.location ?? null,
    experience,
    education,
    skills: parsed.skills.slice(0, LINKEDIN_SKILLS_DISPLAY_MAX),
    featured: existingDraft?.featured?.length ? existingDraft.featured : heuristic.featured,
    profilePhotoUrl: existingDraft?.profilePhotoUrl ?? null,
    coverPhotoUrl: existingDraft?.coverPhotoUrl ?? null,
    sourceAssetId: sourceAssetId ?? existingDraft?.sourceAssetId ?? null,
    generatedAt: existingDraft?.generatedAt ?? new Date().toISOString(),
    lastLinkedInImportAt: existingDraft?.lastLinkedInImportAt ?? null,
    coachNotes: existingDraft?.coachNotes ?? null,
  })!;
}

/** Apply LinkedIn edits back onto About (`parsedData`). */
export function syncParsedFromLinkedInDraft(
  draft: LinkedInProfileDraft,
  existing: ParsedResumeData,
): ParsedResumeData {
  const workExperience: ParsedWorkEntry[] = draft.experience.map((exp) => {
    const prior = existing.workExperience.find(
      (w) => w.id === exp.resumeSourceId || w.id === exp.id,
    );
    const bullets = prior?.bullets?.length ? prior.bullets : paragraphsToBullets(exp.description);
    return {
      id: exp.resumeSourceId || exp.id || newLinkedInEntryId("exp"),
      company: exp.companyRef?.name || exp.company,
      companyRef: exp.companyRef ?? prior?.companyRef ?? null,
      title: exp.title,
      description: exp.description?.trim() || null,
      location: exp.location ?? prior?.location ?? null,
      from: exp.from ?? null,
      to: exp.to ?? null,
      bullets,
    };
  });

  const education: ParsedEducationEntry[] = draft.education.map((edu) => {
    const prior = existing.education.find((e) => e.id === edu.id);
    let degree = edu.degree;
    let field = edu.field ?? prior?.field ?? null;
    if (!field && degree.includes(",")) {
      const parts = degree.split(",").map((s) => s.trim());
      degree = parts[0] ?? degree;
      field = parts.slice(1).join(", ") || null;
    }
    return {
      id: edu.id || prior?.id || newLinkedInEntryId("edu"),
      school: edu.schoolRef?.name || edu.school,
      schoolRef: edu.schoolRef ?? prior?.schoolRef ?? null,
      degree,
      field,
      from: edu.from ?? null,
      to: edu.to ?? null,
    };
  });

  let skillBuckets = { skills: [...existing.skills], tools: [...(existing.tools ?? [])] };
  for (const skill of draft.skills) {
    skillBuckets = addMatchableToBuckets(skillBuckets, skill);
  }
  const reconciled = reconcileSkillsToolsFields(skillBuckets);

  return {
    ...existing,
    summary: draft.about.trim() || existing.summary || null,
    location: draft.location ?? existing.location ?? null,
    workExperience,
    education,
    skills: reconciled.skills,
    tools: reconciled.tools,
    skillGroups: reconciled.skillGroups,
  };
}

export function effectiveLinkedInDraft(input: {
  parsed: ParsedResumeData | null;
  name: string;
  targetRoles: string[];
  headline?: string | null;
  summary?: string | null;
  storedDraft?: LinkedInProfileDraft | null;
  sourceAssetId?: string | null;
}): LinkedInProfileDraft | null {
  const parsed = input.parsed ?? emptyParsedResumeData();
  const hasAbout =
    parsed.workExperience.length > 0 ||
    parsed.education.length > 0 ||
    parsed.skills.length > 0 ||
    Boolean(parsed.summary?.trim()) ||
    Boolean(input.summary?.trim());

  if (!hasAbout && !input.storedDraft) return null;

  return syncLinkedInDraftFromAbout({
    parsed,
    name: input.name,
    targetRoles: input.targetRoles,
    headline: input.headline,
    summary: input.summary ?? parsed.summary,
    existingDraft: input.storedDraft,
    sourceAssetId: input.sourceAssetId,
  });
}

export function loadParsedForSync(raw: unknown): ParsedResumeData {
  return normalizeParsedResumeData(raw) ?? emptyParsedResumeData();
}
