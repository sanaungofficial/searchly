import type { JobStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyIntakeTrackedCompanies } from "@/lib/intake-tracked-companies";
import { upsertManualInboxContact } from "@/lib/inbox-crm/manual-contact";
import { ensureProfileRow } from "@/lib/profile-write";
import { fetchResumeBytes, extractRawResumeText, parseResumeText, fileExtFromUrl } from "@/lib/resume-extract";
import type {
  ClientImportApplyPayload,
  ClientImportApplyResult,
  ClientImportPreview,
} from "@/lib/client-import/types";

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

export async function applyClientImport(
  userId: string,
  payload: ClientImportApplyPayload,
): Promise<ClientImportApplyResult> {
  const { preview } = payload;
  const result: ClientImportApplyResult = {
    profileUpdated: false,
    jobs: { added: 0, updated: 0, skipped: 0 },
    companies: { added: 0, updated: 0, skipped: 0 },
    contacts: { added: 0, updated: 0, skipped: 0 },
    referenceDocumentsStored: preview.referenceDocuments.length,
    errors: [],
  };

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
  for (const row of jobs) {
    const { company, role, url, stage, notes, appliedAt } = row.data;
    try {
      const existing = await prisma.job.findFirst({
        where: {
          userId,
          company: { equals: company, mode: "insensitive" },
          role: { equals: role, mode: "insensitive" },
        },
      });

      if (existing) {
        const patch: { stage?: JobStage; url?: string | null; notes?: string | null; appliedAt?: Date | null } = {};
        if (stage && stage !== existing.stage) patch.stage = stage;
        if (url && url !== existing.url) patch.url = url;
        if (notes && notes !== existing.notes) patch.notes = notes;
        const parsedApplied = parseAppliedAt(appliedAt);
        if (parsedApplied && !existing.appliedAt) patch.appliedAt = parsedApplied;

        if (Object.keys(patch).length > 0) {
          await prisma.job.update({ where: { id: existing.id }, data: patch });
          result.jobs.updated++;
        } else {
          result.jobs.skipped++;
        }
        continue;
      }

      await prisma.job.create({
        data: {
          userId,
          company,
          role,
          url,
          stage,
          notes,
          appliedAt: parseAppliedAt(appliedAt) ?? (stage === "APPLIED" ? new Date() : null),
        },
      });
      result.jobs.added++;
    } catch (err) {
      console.error("[applyClientImport job]", company, role, err);
      result.errors.push(`Job: ${company} — ${role}`);
    }
  }

  const companies = selectedRows(preview, preview.companies, payload.companyIds).map((r) => r.data);
  if (companies.length) {
    const companyResult = await applyIntakeTrackedCompanies(userId, companies, { max: 100 });
    result.companies.added = companyResult.added;
    result.companies.updated = companyResult.updated;
    result.companies.skipped = companyResult.skipped;
    result.errors.push(...companyResult.errors.map((n) => `Company: ${n}`));
  }

  const contacts = selectedRows(preview, preview.contacts, payload.contactIds);
  for (const row of contacts) {
    const c = row.data;
    try {
      const existing = await prisma.inboxContact.findUnique({
        where: { userId_email: { userId, email: c.email.toLowerCase() } },
      });
      await upsertManualInboxContact(userId, c);
      if (existing) result.contacts.updated++;
      else result.contacts.added++;
    } catch (err) {
      console.error("[applyClientImport contact]", c.email, err);
      result.errors.push(`Contact: ${c.email}`);
    }
  }

  return result;
}
