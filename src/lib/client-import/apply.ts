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
import { importJobDedupeKey, normalizeImportJobUrl } from "@/lib/client-import/job-url";
import type {
  ClientImportApplyPayload,
  ClientImportApplyResult,
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
): ExistingJobRow | null {
  const urlKey = normalizeImportJobUrl(data.url);
  if (urlKey) {
    const byUrl = lookups.byUrlKey.get(urlKey);
    if (byUrl) return byUrl;
  }
  return lookups.byCompanyRole.get(`${data.company.toLowerCase()}::${data.role.toLowerCase()}`) ?? null;
}

export async function applyClientImport(
  userId: string,
  payload: ClientImportApplyPayload,
): Promise<ClientImportApplyResult> {
  const { preview } = payload;
  const result: ClientImportApplyResult = {
    profileUpdated: false,
    jobs: { added: 0, updated: 0, skipped: 0, descriptionsEnriched: 0 },
    companies: { added: 0, updated: 0, skipped: 0 },
    contacts: { added: 0, updated: 0, skipped: 0 },
    roles: { targetSelected: 0, deprioritizedSelected: 0 },
    categories: { prioritizedSelected: 0, deprioritizedSelected: 0 },
    applicationQa: { added: 0, skipped: 0 },
    referenceDocumentsStored: preview.referenceDocuments.length,
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
      const merged = [...new Set([...(existing?.targetRoles ?? []), ...payload.profile.targetRoles])];
      profilePatch.targetRoles = merged;
    }
    if (payload.profile.deprioritizedRoles?.length) {
      const merged = [...new Set([...(existing?.deprioritizedRoles ?? []), ...payload.profile.deprioritizedRoles])];
      profilePatch.deprioritizedRoles = merged;
    }
    if (payload.profile.prioritizedCategories?.length) {
      const merged = [...new Set([...(existing?.prioritizedCategories ?? []), ...payload.profile.prioritizedCategories])];
      profilePatch.prioritizedCategories = merged;
      result.categories.prioritizedSelected = payload.profile.prioritizedCategories.length;
    }
    if (payload.profile.deprioritizedCategories?.length) {
      const merged = [
        ...new Set([...(existing?.deprioritizedCategories ?? []), ...payload.profile.deprioritizedCategories]),
      ];
      profilePatch.deprioritizedCategories = merged;
      result.categories.deprioritizedSelected = payload.profile.deprioritizedCategories.length;
    }
    if (payload.profile.searchDuration) {
      profilePatch.searchDuration = payload.profile.searchDuration;
    }
    if (payload.profile.avoidNotes) {
      const motivation = [existing?.careerMotivation, payload.profile.avoidNotes].filter(Boolean).join("\n\n");
      profilePatch.careerMotivation = motivation;
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
    },
  });
  const jobLookups = buildExistingJobLookups(existingUserJobs);

  for (const row of jobs) {
    const { company, role, url, stage, notes, appliedAt } = row.data;
    const enriched = enrichedByName.get(company.toLowerCase());
    const companyName = enriched?.name ?? company;
    const dedupeKey = importJobDedupeKey({ url, company: companyName, role });
    try {
      const existing = findExistingImportJob(jobLookups, { url, company: companyName, role });

      const resolvedNotes = await resolveImportJobNotes({
        company: companyName,
        role,
        url,
        hirebaseSlug: enriched?.hirebaseSlug,
        sheetNotes: notes,
        existingNotes: existing?.notes ?? null,
      });
      if (resolvedNotes.enriched) result.jobs.descriptionsEnriched++;

      if (existing) {
        const patch: {
          stage?: JobStage;
          url?: string | null;
          notes?: string | null;
          userNotes?: string | null;
          appliedAt?: Date | null;
          company?: string;
          role?: string;
        } = {};
        if (stage && stage !== existing.stage) patch.stage = stage;
        if (url && url !== existing.url) patch.url = url;
        if (resolvedNotes.notes && resolvedNotes.notes !== existing.notes) patch.notes = resolvedNotes.notes;
        if (resolvedNotes.userNotes && resolvedNotes.userNotes !== existing.userNotes) {
          patch.userNotes = resolvedNotes.userNotes;
        }
        if (companyName !== existing.company) patch.company = companyName;
        if (role !== existing.role) patch.role = role;
        const parsedApplied = parseAppliedAt(appliedAt);
        if (parsedApplied && !existing.appliedAt) patch.appliedAt = parsedApplied;

        if (Object.keys(patch).length > 0) {
          const updated = await prisma.job.update({ where: { id: existing.id }, data: patch });
          Object.assign(existing, updated);
          result.jobs.updated++;
        } else {
          result.jobs.skipped++;
        }
        jobIdByDedupeKey.set(dedupeKey, existing.id);
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
      };
      const urlKey = normalizeImportJobUrl(created.url);
      if (urlKey) jobLookups.byUrlKey.set(urlKey, createdRow);
      jobLookups.byCompanyRole.set(`${created.company.toLowerCase()}::${created.role.toLowerCase()}`, createdRow);
      jobIdByDedupeKey.set(dedupeKey, created.id);
      result.jobs.added++;
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
        existingKeys.add(key);
      } catch (err) {
        console.error("[applyClientImport qa]", row.data.question, err);
        result.errors.push(`Q&A: ${row.data.question.slice(0, 40)}`);
      }
    }
  }

  return result;
}
