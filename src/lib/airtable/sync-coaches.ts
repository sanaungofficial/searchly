import { CoachStatus } from "@prisma/client";
import { listAirtableCoachRecords } from "@/lib/airtable/client";
import { persistCoachPhotoFromAttachment, shouldUploadCoachPhoto } from "@/lib/airtable/coach-photo";
import { mapAirtableRecordToCoach } from "@/lib/airtable/field-map";
import type { AirtableSyncSummary } from "@/lib/airtable/types";
import { coachProfileSlug } from "@/lib/coach-slug";
import { prisma } from "@/lib/prisma";

export type RunAirtableCoachSyncOptions = {
  /** Cap records for smoke tests */
  limit?: number;
  /** Re-download photos even when already on Kimchi storage */
  refreshPhotos?: boolean;
};

function coachDataFromMapped(mapped: ReturnType<typeof mapAirtableRecordToCoach>) {
  if (!mapped) return null;
  return {
    displayName: mapped.displayName,
    email: mapped.email,
    headline: mapped.headline,
    bio: mapped.bio,
    currentRole: mapped.currentRole,
    currentCompany: mapped.currentCompany,
    location: mapped.location,
    linkedinUrl: mapped.linkedinUrl,
    lelandUrl: mapped.lelandUrl,
    calLink: mapped.calLink,
    firms: mapped.firms,
    schools: mapped.schools,
    specialties: mapped.specialties,
    industries: mapped.industries,
    clientSpecializations: mapped.clientSpecializations,
    hourlyRate: mapped.hourlyRate,
    category: mapped.category,
    featured: mapped.featured,
    status: mapped.status as CoachStatus,
    isProfessionalCoach: mapped.isProfessionalCoach,
    whyCoach: mapped.whyCoach,
    aboutMe: mapped.aboutMe,
    experienceLevel: mapped.experienceLevel,
    clientTier: mapped.clientTier,
    industryYears: mapped.industryYears,
  };
}

export async function runAirtableCoachSync(
  options: RunAirtableCoachSyncOptions = {}
): Promise<AirtableSyncSummary> {
  const started = Date.now();
  const summary: AirtableSyncSummary = {
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    photoUploaded: 0,
    photoErrors: 0,
    pushed: 0,
    errors: [],
    durationMs: 0,
  };

  const records = await listAirtableCoachRecords(
    options.limit ? { maxRecords: options.limit } : undefined
  );
  summary.fetched = records.length;

  for (const record of records) {
    const mapped = mapAirtableRecordToCoach(record);
    if (!mapped) {
      summary.skipped += 1;
      summary.errors.push(`Record ${record.id}: not in sync filter (status must be contract sent, onboarding email sent, or active)`);
      continue;
    }

    const data = coachDataFromMapped(mapped);
    if (!data) {
      summary.skipped += 1;
      continue;
    }

    try {
      let existing = await prisma.coachProfile.findUnique({
        where: { airtableId: mapped.airtableId },
      });

      if (!existing && mapped.email) {
        existing = await prisma.coachProfile.findUnique({ where: { email: mapped.email } });
      }

      if (existing) {
        const updated = await prisma.coachProfile.update({
          where: { id: existing.id },
          data: {
            ...data,
            airtableId: mapped.airtableId,
            slug: existing.slug ?? coachProfileSlug(data.displayName, existing.id),
          },
        });

        if (mapped.photoAttachment) {
          const shouldUpload = shouldUploadCoachPhoto(updated.photoUrl, {
            forceRefresh: options.refreshPhotos,
          });

          if (shouldUpload) {
            const photoUrl = await persistCoachPhotoFromAttachment(
              updated.id,
              mapped.photoAttachment,
              updated.photoUrl,
              { forceRefresh: options.refreshPhotos }
            );
            if (photoUrl && photoUrl !== updated.photoUrl) {
              await prisma.coachProfile.update({
                where: { id: updated.id },
                data: { photoUrl },
              });
              summary.photoUploaded += 1;
            } else if (!photoUrl && mapped.photoAttachment) {
              summary.photoErrors += 1;
            }
          }
        }

        summary.updated += 1;
      } else {
        const created = await prisma.coachProfile.create({
          data: {
            ...data,
            airtableId: mapped.airtableId,
            userId: null,
          },
        });

        const slug = coachProfileSlug(created.displayName, created.id);
        const withSlug = await prisma.coachProfile.update({
          where: { id: created.id },
          data: { slug },
        });

        if (mapped.photoAttachment) {
          const photoUrl = await persistCoachPhotoFromAttachment(
            withSlug.id,
            mapped.photoAttachment,
            null
          );
          if (photoUrl) {
            await prisma.coachProfile.update({
              where: { id: withSlug.id },
              data: { photoUrl },
            });
            summary.photoUploaded += 1;
          } else {
            summary.photoErrors += 1;
          }
        }

        summary.created += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      summary.errors.push(`Record ${record.id}: ${msg}`);
      summary.skipped += 1;
    }
  }

  summary.durationMs = Date.now() - started;
  return summary;
}
