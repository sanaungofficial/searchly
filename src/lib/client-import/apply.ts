import type { JobStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyIntakeTrackedCompanies, type SuggestedTrackedCompany } from "@/lib/intake-tracked-companies";
import { upsertManualInboxContact } from "@/lib/inbox-crm/manual-contact";
import { ensureProfileRow } from "@/lib/profile-write";
import { fetchResumeBytes, extractRawResumeText, parseResumeText, fileExtFromUrl } from "@/lib/resume-extract";
import { enrichImportCompanies } from "@/lib/client-import/enrich-companies";
import {
  clearImportJobPostingCache,
  enrichImportJobPosting,
  jobNotesNeedDescription,
} from "@/lib/client-import/enrich-jobs";
import {
  DEFAULT_JOB_TRACKER_IMPORT_OPTIONS,
  type JobTrackerImportOptions,
} from "@/lib/client-import/job-field-mapping";
import { importJobDedupeKey, normalizeImportJobUrl } from "@/lib/client-import/job-url";
import type {
  ClientImportApplyPayload,
  ClientImportApplyResult,
  ClientImportApplyAudit,
  ClientImportPreview,
} from "@/lib/client-import/types";
import { normalizeQaQuestion, normalizeQaTags } from "@/lib/application-qa";

function selectedRows<T extends { id: string; selected: boolean }>(
  preview: ClientImportPreview,
  bucket: T[],
  ids: string[] | undefined,
): T[] {
  if (!ids?.length) return [];
  const idSet = new Set(ids);
  return bucket.filter((row) => idSet.has(row.id));
}

function parseAppliedAt(raw: string | null): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function companyNamesFromJobs(jobs: { data: { company: string } }[]): string[] {
  return [...new Set(jobs.map((j) => j.data.company.trim()).filter(Boolean))];
}

function hirebaseLinkNote(apiLinked: boolean): string | null {
  return apiLinked ? "Company linked via Hirebase" : null;
}

async function resolveImportJobNotes(input: {
  company: string;
  role: string;
  url: string | null;
  hirebaseSlug?: string | null;
  sheetNotes: string | null;
  existingNotes: string | null;
}): Promise<{ notes: string | null; userNotes: string | null; enriched: boolean }> {
  const userNotes = input.sheetNotes?.trim() || null;

  if (!jobNotesNeedDescription(input.existingNotes)) {
    return { notes: input.existingNotes, userNotes, enriched: false };
  }

  const posting = await enrichImportJobPosting({
    company: input.company,
    role: input.role,
    url: input.url,
    hirebaseSlug: input.hirebaseSlug,
  });

  if (posting.notes) {
    return { notes: posting.notes, userNotes, enriched: true };
  }

  if (input.existingNotes && !jobNotesNeedDescription(input.existingNotes)) {
    return { notes: input.existingNotes, userNotes, enriched: false };
  }

  return { notes: null, userNotes, enriched: false };
}

function mergeNotes(...parts: Array<string | null | undefined>): string | null {
  const merged = parts.filter(Boolean).join(" · ");
  return merged || null;
}

type ExistingJobRow = {
  id: string;
  company: string;
  role: string;
  url: string | null;
  stage: JobStage;
  notes: string | null;
  userNotes: string | null;
  appliedAt: Date | null;
  resumeUrl: string | null;
};

function buildExistingJobLookups(jobs: ExistingJobRow[]) {
  const byUrlKey = new Map<string, ExistingJobRow>();
  const byCompanyRole = new Map<string, ExistingJobRow>();
  for (const job of jobs) {
    const urlKey = normalizeImportJobUrl(job.url);
    if (urlKey && !byUrlKey.has(urlKey)) byUrlKey.set(urlKey, job);
    const crKey = `${job.company.toLowerCase()}::${job.role.toLowerCase()}`;
    if (!byCompanyRole.has(crKey)) byCompanyRole.set(crKey, job);
  }
  return { byUrlKey, byCompanyRole };
}

function findExistingImportJob(
  lookups: ReturnType<typeof buildExistingJobLookups>,
  data: { url: string | null; company: string; role: string },
  options: JobTrackerImportOptions = DEFAULT_JOB_TRACKER_IMPORT_OPTIONS,
): ExistingJobRow | null {
  if (!options.dedupeEnabled) return null;

  if (options.matchField === "company_role") {
    return lookups.byCompanyRole.get(`${data.company.toLowerCase()}::${data.role.toLowerCase()}`) ?? null;
  }

  const urlKey = normalizeImportJobUrl(data.url);
  if (urlKey) {
    const byUrl = lookups.byUrlKey.get(urlKey);
    if (byUrl) return byUrl;
  }
  return lookups.byCompanyRole.get(`${data.company.toLowerCase()}::${data.role.toLowerCase()}`) ?? null;
}

function buildJobPatch(
  existing: ExistingJobRow,
  incoming: {
    company: string;
    role: string;
    url: string | null;
    stage: JobStage;
    notes: string | null;
    userNotes: string | null;
    appliedAt: string | null;
    resumeUrl: string | null;
  },
  resolvedNotes: { notes: string | null; userNotes: string | null },
  options: JobTrackerImportOptions,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const addMissing = options.onMatch === "add_missing";

  const setField = <K extends keyof typeof patch>(key: K, next: unknown, prev: unknown) => {
    if (options.onMatch === "update_all") {
      if (next != null && next !== "") patch[key] = next;
      return;
    }
    if (addMissing) {
      const prevEmpty = prev == null || prev === "";
      if (prevEmpty && next != null && next !== "") patch[key] = next;
      else if (!prevEmpty && next != null && next !== "" && next !== prev) patch[key] = next;
      return;
    }
    if (next != null && next !== "" && next !== prev) patch[key] = next;
  };

  setField("stage", incoming.stage, existing.stage);
  setField("url", incoming.url, existing.url);
  setField("notes", resolvedNotes.notes, existing.notes);
  setField("userNotes", resolvedNotes.userNotes, existing.userNotes);
  setField("company", incoming.company, existing.company);
  setField("role", incoming.role, existing.role);
  const parsedApplied = parseAppliedAt(incoming.appliedAt);
  if (parsedApplied) setField("appliedAt", parsedApplied, existing.appliedAt);
  setField("resumeUrl", incoming.resumeUrl, existing.resumeUrl);

  return patch;
}

function mergeStringList(existing: string[], incoming: string[]): { merged: string[]; added: string[]; skipped: string[] } {
  const existingKeys = new Set(existing.map((v) => v.trim().toLowerCase()));
  const added: string[] = [];
  const skipped: string[] = [];
  const merged = [...existing];
  for (const item of incoming) {
    const key = item.trim().toLowerCase();
    if (!key) continue;
    if (existingKeys.has(key)) {
      skipped.push(item);
      continue;
    }
    existingKeys.add(key);
    added.push(item);
    merged.push(item);
  }
  return { merged, added, skipped };
}

function emptyAudit(): ClientImportApplyAudit {
  return {
    targetRoles: { added: [], skipped: [] },
    deprioritizedRoles: { added: [], skipped: [] },
    prioritizedCategories: { added: [], skipped: [] },
    deprioritizedCategories: { added: [], skipped: [] },
    searchDuration: { set: false, value: null },
    avoidNotes: { appended: false, preview: null },
    applicationQa: { added: [], skipped: [] },
    jobs: { added: [], updated: [], skipped: [] },
    resume: { applied: false, filename: null },
  };
}

export async function applyClientImport(
  userId: string,
  payload: ClientImportApplyPayload,
): Promise<ClientImportApplyResult> {
  const { preview } = payload;
  const audit = emptyAudit();
  const result: ClientImportApplyResult = {
    profileUpdated: false,
    jobs: { added: 0, updated: 0, skipped: 0, descriptionsEnriched: 0 },
    companies: { added: 0, updated: 0, skipped: 0 },
    contacts: { added: 0, updated: 0, skipped: 0 },
    roles: { targetSelected: 0, deprioritizedSelected: 0 },
    categories: { prioritizedSelected: 0, deprioritizedSelected: 0 },
    applicationQa: { added: 0, skipped: 0 },
    referenceDocumentsStored: preview.referenceDocuments.length,
    audit,
    errors: [],
  };

  clearImportJobPostingCache();

  await ensureProfileRow(userId);

  if (payload.applyResume && payload.preview.resume?.assetId) {
    try {
      const asset = await prisma.userAsset.findFirst({
        where: { id: payload.preview.resume.assetId, userId },
      });
      if (asset?.url) {
        const bytes = await fetchResumeBytes(asset.url);
        if (bytes) {
          const ext = fileExtFromUrl(asset.url) || "pdf";
          const text = await extractRawResumeText(bytes, ext);
          const parsed = await parseResumeText(text);
          await prisma.profile.update({
            where: { userId },
            data: {
              resumeUrl: asset.url,
              resumeText: text,
              ...(parsed.parsed ? { parsedData: parsed.parsed } : {}),
            },
          });
          await prisma.userAsset.update({
            where: { id: asset.id },
            data: { isPrimary: true, ...(parsed.parsed ? { parsedData: parsed.parsed, resumeText: text } : {}) },
          });
          result.profileUpdated = true;
          audit.resume.applied = true;
          audit.resume.filename = payload.preview.resume?.filename ?? null;
        }
      }
    } catch (err) {
      console.error("[applyClientImport resume]", err);
      result.errors.push("Resume apply failed");
    }
  }

  if (payload.profile) {
    result.roles.targetSelected = payload.profile.targetRoles?.length ?? 0;
    result.roles.deprioritizedSelected = payload.profile.deprioritizedRoles?.length ?? 0;

    const profilePatch: Record<string, unknown> = {};
    const existing = await prisma.profile.findUnique({ where: { userId } });

    if (payload.profile.targetRoles?.length) {
      const { merged, added, skipped } = mergeStringList(existing?.targetRoles ?? [], payload.profile.targetRoles);
      profilePatch.targetRoles = merged;
      audit.targetRoles.added = added;
      audit.targetRoles.skipped = skipped;
    }
    if (payload.profile.deprioritizedRoles?.length) {
      const { merged, added, skipped } = mergeStringList(
        existing?.deprioritizedRoles ?? [],
        payload.profile.deprioritizedRoles,
      );
      profilePatch.deprioritizedRoles = merged;
      audit.deprioritizedRoles.added = added;
      audit.deprioritizedRoles.skipped = skipped;
    }
    if (payload.profile.prioritizedCategories?.length) {
      const { merged, added, skipped } = mergeStringList(
        existing?.prioritizedCategories ?? [],
        payload.profile.prioritizedCategories,
      );
      profilePatch.prioritizedCategories = merged;
      result.categories.prioritizedSelected = payload.profile.prioritizedCategories.length;
      audit.prioritizedCategories.added = added;
      audit.prioritizedCategories.skipped = skipped;
    }
    if (payload.profile.deprioritizedCategories?.length) {
      const { merged, added, skipped } = mergeStringList(
        existing?.deprioritizedCategories ?? [],
        payload.profile.deprioritizedCategories,
      );
      profilePatch.deprioritizedCategories = merged;
      result.categories.deprioritizedSelected = payload.profile.deprioritizedCategories.length;
      audit.deprioritizedCategories.added = added;
      audit.deprioritizedCategories.skipped = skipped;
    }
    if (payload.profile.searchDuration) {
      profilePatch.searchDuration = payload.profile.searchDuration;
      audit.searchDuration = { set: true, value: payload.profile.searchDuration };
    }
    if (payload.profile.avoidNotes) {
      const motivation = [existing?.careerMotivation, payload.profile.avoidNotes].filter(Boolean).join("\n\n");
      profilePatch.careerMotivation = motivation;
      audit.avoidNotes = {
        appended: true,
        preview: payload.profile.avoidNotes.slice(0, 200),
      };
    }
    if (payload.profile.proposed) {
      Object.assign(profilePatch, payload.profile.proposed);
    }

    if (Object.keys(profilePatch).length > 0) {
      await prisma.profile.update({ where: { userId }, data: profilePatch });
      result.profileUpdated = true;
    }
  }

  const jobs = selectedRows(preview, preview.pipelineJobs, payload.pipelineJobIds);
  const selectedCompanies = selectedRows(preview, preview.companies, payload.companyIds);

  const allCompanyNames = [
    ...selectedCompanies.map((c) => c.data.name),
    ...companyNamesFromJobs(jobs),
  ];
  const enrichedByName = await enrichImportCompanies(allCompanyNames);

  const companiesToApply: SuggestedTrackedCompany[] = [];
  const seenCo = new Set<string>();
  for (const row of selectedCompanies) {
    const key = row.data.name.toLowerCase();
    if (seenCo.has(key)) continue;
    seenCo.add(key);
    const enriched = enrichedByName.get(key);
    companiesToApply.push({
      ...row.data,
      name: enriched?.name ?? row.data.name,
      notes: row.data.notes,
      priority: row.data.priority ?? "MEDIUM",
    });
  }
  for (const job of jobs) {
    const key = job.data.company.toLowerCase();
    if (seenCo.has(key)) continue;
    seenCo.add(key);
    const enriched = enrichedByName.get(key);
    companiesToApply.push({
      name: enriched?.name ?? job.data.company,
      priority: "MEDIUM",
      notes: mergeNotes("Imported from job tracker", hirebaseLinkNote(Boolean(enriched?.apiLinked))),
    });
  }

  if (companiesToApply.length) {
    const companyResult = await applyIntakeTrackedCompanies(userId, companiesToApply, {
      max: 150,
      skipHydrate: true,
    });
    result.companies.added = companyResult.added;
    result.companies.updated = companyResult.updated;
    result.companies.skipped = companyResult.skipped;
    result.errors.push(...companyResult.errors.map((n) => `Company: ${n}`));
  }

  const jobIdByDedupeKey = new Map<string, string>();
  const existingUserJobs = await prisma.job.findMany({
    where: { userId },
    select: {
      id: true,
      company: true,
      role: true,
      url: true,
      stage: true,
      notes: true,
      userNotes: true,
      appliedAt: true,
      resumeUrl: true,
    },
  });
  const jobLookups = buildExistingJobLookups(existingUserJobs);
  const jobImportOptions = payload.jobImportOptions ?? DEFAULT_JOB_TRACKER_IMPORT_OPTIONS;

  for (const row of jobs) {
    const { company, role, url, stage, notes, appliedAt, resumeUrl } = row.data;
    const enriched = enrichedByName.get(company.toLowerCase());
    const companyName = enriched?.name ?? company;
    const dedupeKey = importJobDedupeKey({ url, company: companyName, role });
    try {
      const existing = findExistingImportJob(jobLookups, { url, company: companyName, role }, jobImportOptions);
      const urlChanged =
        Boolean(existing && url && normalizeImportJobUrl(url) !== normalizeImportJobUrl(existing.url));

      const resolvedNotes = await resolveImportJobNotes({
        company: companyName,
        role,
        url,
        hirebaseSlug: enriched?.hirebaseSlug,
        sheetNotes: notes,
        existingNotes: urlChanged ? null : (existing?.notes ?? null),
      });
      if (resolvedNotes.enriched) result.jobs.descriptionsEnriched++;

      if (existing) {
        if (jobImportOptions.onMatch === "skip") {
          result.jobs.skipped++;
          audit.jobs.skipped.push({ company: companyName, role });
          jobIdByDedupeKey.set(dedupeKey, existing.id);
          continue;
        }

        const patch = buildJobPatch(
          existing,
          {
            company: companyName,
            role,
            url,
            stage,
            notes,
            userNotes: resolvedNotes.userNotes,
            appliedAt,
            resumeUrl,
          },
          resolvedNotes,
          jobImportOptions,
        );

        if (Object.keys(patch).length > 0) {
          const updated = await prisma.job.update({ where: { id: existing.id }, data: patch });
          const prevUrlKey = normalizeImportJobUrl(existing.url);
          Object.assign(existing, updated);
          if (urlChanged) {
            if (prevUrlKey) jobLookups.byUrlKey.delete(prevUrlKey);
            const nextUrlKey = normalizeImportJobUrl(updated.url);
            if (nextUrlKey) jobLookups.byUrlKey.set(nextUrlKey, existing);
          }
          result.jobs.updated++;
          audit.jobs.updated.push({
            company: companyName,
            role,
            fields: Object.keys(patch),
          });
        } else {
          result.jobs.skipped++;
          audit.jobs.skipped.push({ company: companyName, role });
        }
        jobIdByDedupeKey.set(dedupeKey, existing.id);
        continue;
      }

      if (jobImportOptions.onNoMatch === "skip") {
        result.jobs.skipped++;
        audit.jobs.skipped.push({ company: companyName, role });
        continue;
      }

      const created = await prisma.job.create({
        data: {
          userId,
          company: companyName,
          role,
          url,
          stage,
          notes: resolvedNotes.notes,
          userNotes: resolvedNotes.userNotes,
          resumeUrl,
          appliedAt: parseAppliedAt(appliedAt) ?? (stage === "APPLIED" ? new Date() : null),
        },
      });
      const createdRow: ExistingJobRow = {
        id: created.id,
        company: created.company,
        role: created.role,
        url: created.url,
        stage: created.stage,
        notes: created.notes,
        userNotes: created.userNotes,
        appliedAt: created.appliedAt,
        resumeUrl: created.resumeUrl,
      };
      const urlKey = normalizeImportJobUrl(created.url);
      if (urlKey) jobLookups.byUrlKey.set(urlKey, createdRow);
      jobLookups.byCompanyRole.set(`${created.company.toLowerCase()}::${created.role.toLowerCase()}`, createdRow);
      jobIdByDedupeKey.set(dedupeKey, created.id);
      result.jobs.added++;
      audit.jobs.added.push({ company: companyName, role });
    } catch (err) {
      console.error("[applyClientImport job]", companyName, role, err);
      result.errors.push(`Job: ${companyName} — ${role}`);
    }
  }

  const contacts = selectedRows(preview, preview.contacts, payload.contactIds);
  for (const row of contacts) {
    const c = row.data;
    try {
      const existing = await prisma.inboxContact.findUnique({
        where: { userId_email: { userId, email: c.email.toLowerCase() } },
      });
      const contact = await upsertManualInboxContact(userId, c);
      if (existing) result.contacts.updated++;
      else result.contacts.added++;

      if (contact && c.company) {
        const companyKey = c.company.toLowerCase();
        const matchingJob = jobs.find((j) => j.data.company.toLowerCase() === companyKey);
        if (matchingJob) {
          const enriched = enrichedByName.get(matchingJob.data.company.toLowerCase());
          const companyName = enriched?.name ?? matchingJob.data.company;
          const jobKey = importJobDedupeKey({
            url: matchingJob.data.url,
            company: companyName,
            role: matchingJob.data.role,
          });
          const jobId = jobIdByDedupeKey.get(jobKey);
          if (jobId) {
            await prisma.jobInboxContact.upsert({
              where: { jobId_contactId: { jobId, contactId: contact.id } },
              create: { userId, jobId, contactId: contact.id },
              update: {},
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("[applyClientImport contact]", c.email, err);
      result.errors.push(`Contact: ${c.email}`);
    }
  }

  const qaRows = selectedRows(preview, preview.applicationQa ?? [], payload.applicationQaIds);
  if (qaRows.length) {
    const existingQa = await prisma.applicationQaEntry.findMany({
      where: { userId },
      select: { question: true },
    });
    const existingKeys = new Set(existingQa.map((e) => normalizeQaQuestion(e.question)));
    const seen = new Set<string>();

    for (const row of qaRows) {
      const key = normalizeQaQuestion(row.data.question);
      if (seen.has(key) || existingKeys.has(key)) {
        result.applicationQa.skipped++;
        audit.applicationQa.skipped.push({
          question: row.data.question.trim(),
          reason: seen.has(key) ? "duplicate in import" : "already in Q&A bank",
        });
        continue;
      }
      seen.add(key);
      try {
        await prisma.applicationQaEntry.create({
          data: {
            userId,
            question: row.data.question.trim(),
            answer: row.data.answer,
            tags: normalizeQaTags(row.data.tags?.length ? row.data.tags : ["import"]),
          },
        });
        result.applicationQa.added++;
        audit.applicationQa.added.push({ question: row.data.question.trim() });
        existingKeys.add(key);
      } catch (err) {
        console.error("[applyClientImport qa]", row.data.question, err);
        result.errors.push(`Q&A: ${row.data.question.slice(0, 40)}`);
      }
    }
  }

  return result;
}
